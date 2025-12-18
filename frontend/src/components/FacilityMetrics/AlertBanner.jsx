import React, { useState, useMemo } from 'react';
import { AlertTriangle, TrendingDown, Shield, DollarSign, X } from 'lucide-react';

const DISMISSED_ALERTS_KEY = 'snfalyze_dismissed_alerts';

// Get dismissed alerts from localStorage
const getDismissedAlerts = () => {
  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Save dismissed alert
const dismissAlert = (alertId) => {
  const dismissed = getDismissedAlerts();
  dismissed[alertId] = Date.now();
  localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(dismissed));
};

// Check if alert was dismissed (within last 30 days)
const isAlertDismissed = (alertId) => {
  const dismissed = getDismissedAlerts();
  if (!dismissed[alertId]) return false;
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return dismissed[alertId] > thirtyDaysAgo;
};

/**
 * Generate alerts based on facility data
 */
const generateAlerts = (facility) => {
  if (!facility) return [];

  const alerts = [];
  const ccn = facility.ccn;

  // SFF Status Alert
  if (facility.sff_or_candidate === 'SFF') {
    alerts.push({
      id: `${ccn}-sff`,
      type: 'critical',
      icon: Shield,
      title: 'Special Focus Facility',
      message: 'This facility is on the CMS Special Focus Facility list due to persistent quality issues. It is subject to enhanced monitoring and more frequent inspections.',
    });
  } else if (facility.sff_or_candidate === 'Candidate') {
    alerts.push({
      id: `${ccn}-sff-candidate`,
      type: 'warning',
      icon: Shield,
      title: 'SFF Candidate',
      message: 'This facility is a candidate for the Special Focus Facility program. It may be selected for enhanced monitoring.',
    });
  }

  // Rating Drop Alert (check trends)
  if (facility.trends?.overall_rating) {
    const ratingChange = facility.trends.overall_rating;
    if (ratingChange < 0) {
      alerts.push({
        id: `${ccn}-rating-drop`,
        type: 'warning',
        icon: TrendingDown,
        title: 'Rating Decreased',
        message: `The overall star rating dropped by ${Math.abs(ratingChange)} star${Math.abs(ratingChange) !== 1 ? 's' : ''} in the past year.`,
      });
    }
  }

  // Recent Penalties Alert
  const penaltyAmount = parseFloat(facility.fine_total_dollars) || 0;
  if (penaltyAmount > 100000) {
    alerts.push({
      id: `${ccn}-penalties`,
      type: 'warning',
      icon: DollarSign,
      title: 'Significant Penalty History',
      message: `This facility has been assessed $${(penaltyAmount / 1000).toFixed(0)}K in civil monetary penalties.`,
    });
  }

  // Abuse Icon Alert
  if (facility.abuse_icon === 'Y') {
    alerts.push({
      id: `${ccn}-abuse`,
      type: 'critical',
      icon: AlertTriangle,
      title: 'Abuse Violation',
      message: 'This facility has a substantiated abuse violation in its survey history.',
    });
  }

  // Low Rating Alert
  const overallRating = parseInt(facility.overall_rating);
  if (overallRating === 1) {
    alerts.push({
      id: `${ccn}-low-rating`,
      type: 'warning',
      icon: AlertTriangle,
      title: '1-Star Rating',
      message: 'This facility has the lowest possible overall rating. Consider reviewing detailed quality metrics.',
    });
  }

  return alerts;
};

const AlertBannerItem = ({ alert, onDismiss }) => {
  const Icon = alert.icon;
  const typeClasses = {
    critical: 'alert-banner-critical',
    warning: 'alert-banner-warning',
    info: 'alert-banner-info',
  };

  return (
    <div className={`alert-banner ${typeClasses[alert.type] || ''}`}>
      <div className="alert-banner-icon">
        <Icon size={18} />
      </div>
      <div className="alert-banner-content">
        <span className="alert-banner-title">{alert.title}</span>
        <span className="alert-banner-message">{alert.message}</span>
      </div>
      <button
        className="alert-banner-dismiss"
        onClick={() => onDismiss(alert.id)}
        aria-label="Dismiss alert"
      >
        <X size={16} />
      </button>
    </div>
  );
};

const AlertBanner = ({ facility }) => {
  const [dismissedIds, setDismissedIds] = useState(() =>
    Object.keys(getDismissedAlerts())
  );

  const alerts = useMemo(() => {
    const allAlerts = generateAlerts(facility);
    return allAlerts.filter(alert => !isAlertDismissed(alert.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facility, dismissedIds.length]);

  const handleDismiss = (alertId) => {
    dismissAlert(alertId);
    setDismissedIds(Object.keys(getDismissedAlerts()));
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="alert-banners">
      {alerts.map(alert => (
        <AlertBannerItem
          key={alert.id}
          alert={alert}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
};

export default AlertBanner;
