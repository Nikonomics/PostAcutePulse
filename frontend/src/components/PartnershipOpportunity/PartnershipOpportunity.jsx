import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, TrendingUp, Heart, Home, DollarSign,
  Loader, AlertCircle, Users, Activity, MapPin, Star,
  ChevronDown, ChevronUp, RotateCcw, Sliders
} from 'lucide-react';
import { getPartnershipProjection } from '../../api/facilityService';
import './PartnershipOpportunity.css';

// Default assumptions matching the API
const DEFAULT_ASSUMPTIONS = {
  shortTermBedsPct: 35,
  hhAppropriatePct: 75,
  hhLOS: 2.4,
  hhRevenuePerEpisode: 3200,
  referralCaptureRate: 80,
  hhToHospiceConversionRate: 10,
  facilityHospiceCensusPct: 10,
  hospiceDailyRate: 200
};

const PartnershipOpportunity = ({ ccn }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Adjustable parameters state
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS });
  const [originalAssumptions, setOriginalAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS });

  useEffect(() => {
    if (ccn) {
      fetchPartnershipData();
    }
  }, [ccn]);

  const fetchPartnershipData = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getPartnershipProjection(ccn);

      if (result.success) {
        setData(result.data);
        // Set initial assumptions from API response
        const apiAssumptions = {
          shortTermBedsPct: Math.round(result.data.assumptions.shortTermBedsPct * 100),
          hhAppropriatePct: Math.round(result.data.assumptions.hhAppropriatePct * 100),
          hhLOS: result.data.assumptions.hhLOS,
          hhRevenuePerEpisode: result.data.assumptions.hhRevenuePerEpisode || result.data.homeHealth.revenuePerEpisode,
          referralCaptureRate: Math.round(result.data.assumptions.referralCaptureRate * 100),
          hhToHospiceConversionRate: Math.round(result.data.assumptions.hhToHospiceConversionRate * 100),
          facilityHospiceCensusPct: Math.round(result.data.assumptions.facilityHospiceCensusPct * 100),
          hospiceDailyRate: result.data.assumptions.hospiceDailyRate
        };
        setAssumptions(apiAssumptions);
        setOriginalAssumptions(apiAssumptions);
      } else {
        setError(result.error || 'Failed to load partnership data');
      }
    } catch (err) {
      console.error('Failed to fetch partnership data:', err);
      setError(err.message || 'Failed to load partnership data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate projections based on current assumptions
  const projections = useMemo(() => {
    if (!data) return null;

    const { facility } = data;
    const totalBeds = facility.totalBeds;
    const occupancyRate = facility.occupancyRate / 100;

    // Convert percentages back to decimals for calculations
    const shortTermBedsPct = assumptions.shortTermBedsPct / 100;
    const longTermBedsPct = 1 - shortTermBedsPct;
    const hhAppropriatePct = assumptions.hhAppropriatePct / 100;
    const referralCaptureRate = assumptions.referralCaptureRate / 100;
    const hhToHospiceConversionRate = assumptions.hhToHospiceConversionRate / 100;
    const facilityHospiceCensusPct = assumptions.facilityHospiceCensusPct / 100;

    // Bed allocation
    const shortTermBeds = Math.round(totalBeds * shortTermBedsPct);
    const longTermBeds = Math.round(totalBeds * longTermBedsPct);
    const shortTermCensus = Math.round(shortTermBeds * occupancyRate);
    const longTermCensus = Math.round(longTermBeds * occupancyRate);
    const monthlyDischarges = shortTermCensus;
    const annualDischarges = monthlyDischarges * 12;

    // Home Health
    const hhAppropriateMonthly = Math.round(monthlyDischarges * hhAppropriatePct);
    const hhAppropriateAnnual = hhAppropriateMonthly * 12;
    const partnershipHHCensus = Math.round(monthlyDischarges * referralCaptureRate * assumptions.hhLOS);
    const partnershipHHRevenueMonthly = Math.round((partnershipHHCensus * assumptions.hhRevenuePerEpisode) / 2);
    const partnershipHHRevenueAnnual = partnershipHHRevenueMonthly * 12;

    // Hospice
    const facilityHospiceCensus = Math.round(longTermCensus * facilityHospiceCensusPct);
    const partnershipHOSCensusFacility = Math.round(facilityHospiceCensus * referralCaptureRate);
    const partnershipHOSCensusFromHH = Math.round(partnershipHHCensus * hhToHospiceConversionRate);
    const totalPartnershipHOSCensus = partnershipHOSCensusFacility + partnershipHOSCensusFromHH;
    const partnershipHOSRevenueMonthly = Math.round(totalPartnershipHOSCensus * 30 * assumptions.hospiceDailyRate);
    const partnershipHOSRevenueAnnual = partnershipHOSRevenueMonthly * 12;

    // Total
    const totalPartnershipRevenueMonthly = partnershipHHRevenueMonthly + partnershipHOSRevenueMonthly;
    const totalPartnershipRevenueAnnual = totalPartnershipRevenueMonthly * 12;

    return {
      bedAllocation: { shortTermBeds, longTermBeds, shortTermCensus, longTermCensus },
      throughput: { monthlyDischarges, annualDischarges },
      homeHealth: {
        appropriateDischargesMonthly: hhAppropriateMonthly,
        appropriateDischargesAnnual: hhAppropriateAnnual,
        partnershipCensus: partnershipHHCensus,
        revenueMonthly: partnershipHHRevenueMonthly,
        revenueAnnual: partnershipHHRevenueAnnual
      },
      hospice: {
        facilityHospiceCensus,
        partnershipCensusFromFacility: partnershipHOSCensusFacility,
        partnershipCensusFromHH: partnershipHOSCensusFromHH,
        totalPartnershipCensus: totalPartnershipHOSCensus,
        revenueMonthly: partnershipHOSRevenueMonthly,
        revenueAnnual: partnershipHOSRevenueAnnual
      },
      totalPartnership: {
        revenueMonthly: totalPartnershipRevenueMonthly,
        revenueAnnual: totalPartnershipRevenueAnnual
      }
    };
  }, [data, assumptions]);

  // Calculate deltas from original values
  const deltas = useMemo(() => {
    if (!projections || !data) return null;

    const originalAnnual = data.totalPartnership.revenueAnnual;
    const currentAnnual = projections.totalPartnership.revenueAnnual;
    const annualDelta = currentAnnual - originalAnnual;

    return {
      annualRevenue: annualDelta,
      hasChanges: Object.keys(assumptions).some(
        key => assumptions[key] !== originalAssumptions[key]
      )
    };
  }, [projections, data, assumptions, originalAssumptions]);

  // Formatting helpers
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDelta = (amount) => {
    if (!amount) return '';
    const sign = amount >= 0 ? '+' : '';
    return `${sign}${formatCurrency(amount)}`;
  };

  const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toFixed(decimals);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}%`;
  };

  // Check if a parameter has been modified
  const isModified = (key) => assumptions[key] !== originalAssumptions[key];

  // Handle parameter changes
  const handleAssumptionChange = (key, value) => {
    setAssumptions(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  // Reset to defaults
  const handleReset = () => {
    setAssumptions({ ...originalAssumptions });
  };

  // Star rating component
  const StarRating = ({ rating, size = 14 }) => (
    <div className="partnership-star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= rating ? '#fbbf24' : 'none'}
          stroke={star <= rating ? '#fbbf24' : '#d1d5db'}
        />
      ))}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="partnership-loading">
        <Loader size={32} className="partnership-spinner" />
        <p>Loading partnership opportunity data...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="partnership-error">
        <AlertCircle size={32} />
        <h4>Failed to load partnership data</h4>
        <p>{error}</p>
        <button className="partnership-retry-btn" onClick={fetchPartnershipData}>
          Try Again
        </button>
      </div>
    );
  }

  if (!data || !projections) return null;

  const { facility, vbp, hhMarket } = data;

  return (
    <div className="partnership-opportunity">
      {/* SECTION 1: FACILITY OVERVIEW */}
      <div className="partnership-section">
        <div className="partnership-section-header">
          <Building2 size={20} />
          <h3>Facility Overview</h3>
        </div>
        <div className="partnership-overview-grid">
          <div className="partnership-overview-card">
            <div className="partnership-facility-header">
              <h4>{facility.name}</h4>
              <div className="partnership-facility-location">
                <MapPin size={14} />
                {facility.city}, {facility.state}
              </div>
            </div>
            <div className="partnership-facility-details">
              <div className="partnership-detail-row">
                <span className="partnership-label">Total Beds</span>
                <span className="partnership-value">{facility.totalBeds}</span>
              </div>
              <div className="partnership-detail-row">
                <span className="partnership-label">Occupancy Rate</span>
                <span className="partnership-value">{facility.occupancyRate}%</span>
              </div>
              <div className="partnership-detail-row">
                <span className="partnership-label">Overall Rating</span>
                <span className="partnership-value">
                  <StarRating rating={facility.overallRating} />
                </span>
              </div>
              <div className="partnership-detail-row">
                <span className="partnership-label">Chain Affiliation</span>
                <span className="partnership-value">{facility.chainName || 'Independent'}</span>
              </div>
            </div>
          </div>

          <div className="partnership-overview-card">
            <div className="partnership-market-header">
              <h4>Market Information</h4>
            </div>
            <div className="partnership-facility-details">
              <div className="partnership-detail-row">
                <span className="partnership-label">County</span>
                <span className="partnership-value">{facility.county || 'N/A'}</span>
              </div>
              <div className="partnership-detail-row">
                <span className="partnership-label">Ownership</span>
                <span className="partnership-value">{facility.ownershipType || 'N/A'}</span>
              </div>
              {hhMarket && (
                <>
                  <div className="partnership-detail-row">
                    <span className="partnership-label">HH Agencies ({hhMarket.level})</span>
                    <span className="partnership-value">{hhMarket.agencyCount}</span>
                  </div>
                  <div className="partnership-detail-row">
                    <span className="partnership-label">Avg HH Quality</span>
                    <span className="partnership-value">
                      {hhMarket.avgQualityRating ? formatNumber(hhMarket.avgQualityRating, 1) + ' stars' : 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADJUSTABLE ASSUMPTIONS SECTION */}
      <div className="partnership-section partnership-assumptions-section">
        <button
          className="partnership-assumptions-toggle"
          onClick={() => setShowAssumptions(!showAssumptions)}
        >
          <div className="partnership-assumptions-toggle-left">
            <Sliders size={18} />
            <span>Adjust Assumptions</span>
            {deltas?.hasChanges && (
              <span className="partnership-modified-badge">Modified</span>
            )}
          </div>
          <div className="partnership-assumptions-toggle-right">
            {deltas?.hasChanges && (
              <span className={`partnership-delta ${deltas.annualRevenue >= 0 ? 'positive' : 'negative'}`}>
                {formatDelta(deltas.annualRevenue)}/year
              </span>
            )}
            {showAssumptions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showAssumptions && (
          <div className="partnership-assumptions-panel">
            <div className="partnership-assumptions-header">
              <p className="partnership-assumptions-desc">
                Adjust parameters below to model different partnership scenarios.
                Changes are calculated instantly.
              </p>
              {deltas?.hasChanges && (
                <button className="partnership-reset-btn" onClick={handleReset}>
                  <RotateCcw size={14} />
                  Reset to Defaults
                </button>
              )}
            </div>

            <div className="partnership-assumptions-grid">
              {/* Short-Term Bed % */}
              <div className={`partnership-assumption-control ${isModified('shortTermBedsPct') ? 'modified' : ''}`}>
                <label>
                  Short-Term Bed %
                  <span className="partnership-assumption-value">{assumptions.shortTermBedsPct}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={assumptions.shortTermBedsPct}
                  onChange={(e) => handleAssumptionChange('shortTermBedsPct', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>10%</span>
                  <span>60%</span>
                </div>
              </div>

              {/* HH-Appropriate % */}
              <div className={`partnership-assumption-control ${isModified('hhAppropriatePct') ? 'modified' : ''}`}>
                <label>
                  HH-Appropriate %
                  <span className="partnership-assumption-value">{assumptions.hhAppropriatePct}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={assumptions.hhAppropriatePct}
                  onChange={(e) => handleAssumptionChange('hhAppropriatePct', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* HH Average LOS */}
              <div className={`partnership-assumption-control ${isModified('hhLOS') ? 'modified' : ''}`}>
                <label>
                  HH Avg LOS (months)
                  <span className="partnership-assumption-value">{assumptions.hhLOS}</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="6.0"
                  step="0.1"
                  value={assumptions.hhLOS}
                  onChange={(e) => handleAssumptionChange('hhLOS', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>1.0</span>
                  <span>6.0</span>
                </div>
              </div>

              {/* HH Revenue/Episode */}
              <div className={`partnership-assumption-control ${isModified('hhRevenuePerEpisode') ? 'modified' : ''}`}>
                <label>
                  HH Revenue/Episode
                  <span className="partnership-assumption-value">{formatCurrency(assumptions.hhRevenuePerEpisode)}</span>
                </label>
                <input
                  type="range"
                  min="1000"
                  max="5000"
                  step="100"
                  value={assumptions.hhRevenuePerEpisode}
                  onChange={(e) => handleAssumptionChange('hhRevenuePerEpisode', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>$1,000</span>
                  <span>$5,000</span>
                </div>
              </div>

              {/* Referral Capture Rate */}
              <div className={`partnership-assumption-control ${isModified('referralCaptureRate') ? 'modified' : ''}`}>
                <label>
                  Referral Capture Rate
                  <span className="partnership-assumption-value">{assumptions.referralCaptureRate}%</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={assumptions.referralCaptureRate}
                  onChange={(e) => handleAssumptionChange('referralCaptureRate', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>20%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* HH to Hospice Conversion */}
              <div className={`partnership-assumption-control ${isModified('hhToHospiceConversionRate') ? 'modified' : ''}`}>
                <label>
                  HH to Hospice Conversion
                  <span className="partnership-assumption-value">{assumptions.hhToHospiceConversionRate}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={assumptions.hhToHospiceConversionRate}
                  onChange={(e) => handleAssumptionChange('hhToHospiceConversionRate', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>0%</span>
                  <span>30%</span>
                </div>
              </div>

              {/* Facility Hospice Census % */}
              <div className={`partnership-assumption-control ${isModified('facilityHospiceCensusPct') ? 'modified' : ''}`}>
                <label>
                  Facility Hospice Census %
                  <span className="partnership-assumption-value">{assumptions.facilityHospiceCensusPct}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="5"
                  value={assumptions.facilityHospiceCensusPct}
                  onChange={(e) => handleAssumptionChange('facilityHospiceCensusPct', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>5%</span>
                  <span>25%</span>
                </div>
              </div>

              {/* Hospice Daily Rate */}
              <div className={`partnership-assumption-control ${isModified('hospiceDailyRate') ? 'modified' : ''}`}>
                <label>
                  Hospice Daily Rate
                  <span className="partnership-assumption-value">{formatCurrency(assumptions.hospiceDailyRate)}</span>
                </label>
                <input
                  type="range"
                  min="150"
                  max="300"
                  step="10"
                  value={assumptions.hospiceDailyRate}
                  onChange={(e) => handleAssumptionChange('hospiceDailyRate', e.target.value)}
                />
                <div className="partnership-range-labels">
                  <span>$150</span>
                  <span>$300</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: FACILITY OPPORTUNITY PROFILE */}
      <div className="partnership-section">
        <div className="partnership-section-header">
          <TrendingUp size={20} />
          <h3>Facility Opportunity Profile</h3>
          {deltas?.hasChanges && (
            <span className={`partnership-header-delta ${deltas.annualRevenue >= 0 ? 'positive' : 'negative'}`}>
              {formatDelta(deltas.annualRevenue)}/year vs. baseline
            </span>
          )}
        </div>

        {/* Basic Metrics */}
        <div className="partnership-subsection">
          <h4 className="partnership-subsection-title">
            <Activity size={16} />
            Basic Metrics
          </h4>
          <div className="partnership-metrics-grid">
            <div className="partnership-metric">
              <span className="partnership-metric-label">Total Census</span>
              <span className="partnership-metric-value">
                {formatNumber(projections.bedAllocation.shortTermCensus + projections.bedAllocation.longTermCensus, 0)}
              </span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Short-Term Census</span>
              <span className="partnership-metric-value">{formatNumber(projections.bedAllocation.shortTermCensus, 0)}</span>
              <span className="partnership-metric-note">({projections.bedAllocation.shortTermBeds} beds @ {facility.occupancyRate}%)</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Long-Term Census</span>
              <span className="partnership-metric-value">{formatNumber(projections.bedAllocation.longTermCensus, 0)}</span>
              <span className="partnership-metric-note">({projections.bedAllocation.longTermBeds} beds @ {facility.occupancyRate}%)</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Monthly Discharges</span>
              <span className="partnership-metric-value">{projections.throughput.monthlyDischarges}</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Annual Discharges</span>
              <span className="partnership-metric-value">{projections.throughput.annualDischarges}</span>
            </div>
          </div>
        </div>

        {/* Home Health Opportunity */}
        <div className="partnership-subsection partnership-hh">
          <h4 className="partnership-subsection-title">
            <Home size={16} />
            Home Health Opportunity
          </h4>
          <div className="partnership-metrics-grid">
            <div className="partnership-metric">
              <span className="partnership-metric-label">HH-Appropriate Discharges (Monthly)</span>
              <span className="partnership-metric-value">{projections.homeHealth.appropriateDischargesMonthly}</span>
              <span className="partnership-metric-note">({formatPercent(assumptions.hhAppropriatePct)} of discharges)</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">HH-Appropriate Discharges (Annual)</span>
              <span className="partnership-metric-value">{projections.homeHealth.appropriateDischargesAnnual}</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Est. HH Revenue/Episode</span>
              <span className="partnership-metric-value">{formatCurrency(assumptions.hhRevenuePerEpisode)}</span>
            </div>
            <div className="partnership-metric highlight-hh">
              <span className="partnership-metric-label">Partnership HH Census</span>
              <span className="partnership-metric-value">{projections.homeHealth.partnershipCensus}</span>
              <span className="partnership-metric-note">({formatPercent(assumptions.referralCaptureRate)} capture x {assumptions.hhLOS} mo LOS)</span>
            </div>
            <div className="partnership-metric highlight-hh">
              <span className="partnership-metric-label">Partnership HH Revenue (Monthly)</span>
              <span className="partnership-metric-value revenue">{formatCurrency(projections.homeHealth.revenueMonthly)}</span>
            </div>
            <div className="partnership-metric highlight-hh">
              <span className="partnership-metric-label">Partnership HH Revenue (Annual)</span>
              <span className="partnership-metric-value revenue">{formatCurrency(projections.homeHealth.revenueAnnual)}</span>
            </div>
          </div>
        </div>

        {/* Hospice Opportunity */}
        <div className="partnership-subsection partnership-hospice">
          <h4 className="partnership-subsection-title">
            <Heart size={16} />
            Hospice Opportunity
          </h4>
          <div className="partnership-metrics-grid">
            <div className="partnership-metric">
              <span className="partnership-metric-label">Est. Facility Hospice Census</span>
              <span className="partnership-metric-value">{projections.hospice.facilityHospiceCensus}</span>
              <span className="partnership-metric-note">({formatPercent(assumptions.facilityHospiceCensusPct)} of LT residents)</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Partnership Census (from Facility)</span>
              <span className="partnership-metric-value">{projections.hospice.partnershipCensusFromFacility}</span>
              <span className="partnership-metric-note">({formatPercent(assumptions.referralCaptureRate)} capture)</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Partnership Census (from HH Conversions)</span>
              <span className="partnership-metric-value">{projections.hospice.partnershipCensusFromHH}</span>
              <span className="partnership-metric-note">({formatPercent(assumptions.hhToHospiceConversionRate)} of HH census)</span>
            </div>
            <div className="partnership-metric highlight-hospice">
              <span className="partnership-metric-label">Total Partnership Hospice Census</span>
              <span className="partnership-metric-value">{projections.hospice.totalPartnershipCensus}</span>
            </div>
            <div className="partnership-metric">
              <span className="partnership-metric-label">Hospice Daily Rate</span>
              <span className="partnership-metric-value">{formatCurrency(assumptions.hospiceDailyRate)}</span>
            </div>
            <div className="partnership-metric highlight-hospice">
              <span className="partnership-metric-label">Partnership Hospice Revenue (Monthly)</span>
              <span className="partnership-metric-value revenue">{formatCurrency(projections.hospice.revenueMonthly)}</span>
            </div>
            <div className="partnership-metric highlight-hospice">
              <span className="partnership-metric-label">Partnership Hospice Revenue (Annual)</span>
              <span className="partnership-metric-value revenue">{formatCurrency(projections.hospice.revenueAnnual)}</span>
            </div>
          </div>
        </div>

        {/* Total Partnership */}
        <div className="partnership-subsection partnership-total">
          <h4 className="partnership-subsection-title">
            <DollarSign size={16} />
            Total Partnership Revenue
          </h4>
          <div className="partnership-total-grid">
            <div className="partnership-total-card">
              <span className="partnership-total-label">Monthly</span>
              <span className="partnership-total-value">{formatCurrency(projections.totalPartnership.revenueMonthly)}</span>
              <div className="partnership-total-breakdown">
                <span>HH: {formatCurrency(projections.homeHealth.revenueMonthly)}</span>
                <span>Hospice: {formatCurrency(projections.hospice.revenueMonthly)}</span>
              </div>
            </div>
            <div className="partnership-total-card primary">
              <span className="partnership-total-label">Annual</span>
              <span className="partnership-total-value">{formatCurrency(projections.totalPartnership.revenueAnnual)}</span>
              {deltas?.hasChanges && (
                <div className={`partnership-total-delta ${deltas.annualRevenue >= 0 ? 'positive' : 'negative'}`}>
                  {formatDelta(deltas.annualRevenue)} vs. baseline
                </div>
              )}
              <div className="partnership-total-breakdown">
                <span>HH: {formatCurrency(projections.homeHealth.revenueAnnual)}</span>
                <span>Hospice: {formatCurrency(projections.hospice.revenueAnnual)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* VBP Impact */}
        {vbp && (
          <div className="partnership-subsection partnership-vbp">
            <h4 className="partnership-subsection-title">
              <Users size={16} />
              VBP Impact
            </h4>
            <div className="partnership-vbp-grid">
              <div className="partnership-vbp-item">
                <span className="partnership-vbp-label">Fiscal Year</span>
                <span className="partnership-vbp-value">{vbp.fiscalYear}</span>
              </div>
              <div className="partnership-vbp-item">
                <span className="partnership-vbp-label">Payment Multiplier</span>
                <span className={`partnership-vbp-value ${vbp.incentiveMultiplier >= 1 ? 'positive' : 'negative'}`}>
                  {vbp.incentiveMultiplier?.toFixed(4) || 'N/A'}
                </span>
              </div>
              <div className="partnership-vbp-item">
                <span className="partnership-vbp-label">Performance Score</span>
                <span className="partnership-vbp-value">{vbp.performanceScore?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnershipOpportunity;
