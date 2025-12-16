import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Star, Users, AlertCircle, DollarSign,
  Loader, ArrowLeft, TrendingUp, TrendingDown, Activity,
  Shield, Flame, Calendar, Award, Bookmark, BookmarkCheck,
  ChevronRight, AlertTriangle, CheckCircle, Clock, Map,
  BarChart2, PieChart
} from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { getFacilityProfile, getFacilityCompetitors } from '../api/facilityService';
import {
  saveMarketFacility,
  removeSavedItem
} from '../api/savedItemsService';
import { useAuth } from '../context/UserContext';
import { useGoogleMaps } from '../context/GoogleMapsContext';
import './FacilityProfile.css';

function FacilityProfile() {
  const { ccn } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [profile, setProfile] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Save/bookmark state
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState(null);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Map state
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [showMap, setShowMap] = useState(true);

  // Use shared Google Maps context
  const { isLoaded: mapLoaded } = useGoogleMaps();

  // Load profile data
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getFacilityProfile(ccn);
      if (data.success) {
        setProfile(data);
      } else {
        setError(data.error || 'Failed to load facility');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load facility profile');
    } finally {
      setLoading(false);
    }
  }, [ccn]);

  // Load competitors
  const loadCompetitors = useCallback(async () => {
    try {
      const data = await getFacilityCompetitors(ccn, 25, 15);
      if (data.success) {
        setCompetitors(data.competitors || []);
      }
    } catch (err) {
      console.error('Failed to load competitors:', err);
    }
  }, [ccn]);

  useEffect(() => {
    loadProfile();
    loadCompetitors();
  }, [loadProfile, loadCompetitors]);

  // Check if facility is saved
  // Note: Disabled - backend doesn't support checking by CCN
  useEffect(() => {
    // Checking saved status by CCN is not supported
    // Backend only supports checking by facility database ID
    // Skipping check to avoid 400 error
  }, [profile?.facility?.ccn]);

  // Toggle save/bookmark
  const handleToggleSave = async () => {
    if (!profile?.facility) return;

    setSavingBookmark(true);
    try {
      if (isSaved && savedItemId) {
        await removeSavedItem(savedItemId);
        setIsSaved(false);
        setSavedItemId(null);
        toast.success('Removed from saved items');
      } else {
        // Get facility type and ID
        const facilityType = 'SNF'; // Default to SNF for now
        const facilityId = profile.facility.id || profile.facility.facility_id;

        if (!facilityId) {
          toast.error('Cannot save facility: missing facility ID');
          return;
        }

        const result = await saveMarketFacility(facilityType, facilityId);

        if (result.success) {
          setIsSaved(true);
          setSavedItemId(result.data?.id);
          toast.success('Added to saved items');
        } else if (result.alreadySaved) {
          setIsSaved(true);
          setSavedItemId(result.saved_item_id);
          toast.info('Facility is already in your saved items');
        }
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
      toast.error('Failed to update saved status');
    } finally {
      setSavingBookmark(false);
    }
  };

  // Helpers
  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getRatingColor = (rating) => {
    const colors = {
      5: '#22c55e',
      4: '#84cc16',
      3: '#eab308',
      2: '#f97316',
      1: '#ef4444',
    };
    return colors[rating] || '#9ca3af';
  };

  const getSeverityColor = (code) => {
    if (!code) return '#9ca3af';
    const letter = code[0];
    if (['J', 'K', 'L'].includes(letter)) return '#ef4444'; // Immediate jeopardy
    if (['G', 'H', 'I'].includes(letter)) return '#f97316'; // Actual harm
    if (['D', 'E', 'F'].includes(letter)) return '#eab308'; // Potential harm
    return '#22c55e'; // Minimal
  };

  const getSeverityLabel = (code) => {
    if (!code) return 'Unknown';
    const letter = code[0];
    if (['J', 'K', 'L'].includes(letter)) return 'Immediate Jeopardy';
    if (['G', 'H', 'I'].includes(letter)) return 'Actual Harm';
    if (['D', 'E', 'F'].includes(letter)) return 'Potential Harm';
    return 'Minimal';
  };

  // Star Rating Component
  const StarRating = ({ rating, size = 16 }) => (
    <div className="star-rating">
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

  // Map center calculation
  const mapCenter = useMemo(() => {
    if (!profile?.facility?.latitude || !profile?.facility?.longitude) {
      return { lat: 39.8283, lng: -98.5795 };
    }
    return {
      lat: parseFloat(profile.facility.latitude),
      lng: parseFloat(profile.facility.longitude)
    };
  }, [profile]);

  // Prepare chart data
  const trendsData = useMemo(() => {
    if (!profile?.facility?.trends) return null;
    return profile.facility.trends;
  }, [profile]);

  // Loading state
  if (loading) {
    return (
      <div className="facility-profile-page">
        <div className="loading-container">
          <Loader size={48} className="loading-spinner" />
          <p>Loading facility profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="facility-profile-page">
        <div className="error-container">
          <AlertCircle size={48} color="#dc2626" />
          <h3>Failed to load facility</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!profile?.facility) return null;

  const facility = profile.facility;
  const beds = parseInt(facility.certified_beds) || 0;
  const residents = parseInt(facility.average_residents_per_day) || 0;
  const occupancy = beds > 0 ? Math.round((residents / beds) * 100) : 0;

  return (
    <div className="facility-profile-page">
      {/* Header */}
      <div className="facility-header">
        <div className="facility-header-content">
          <div className="facility-header-left">
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
            <div className="facility-header-rating">
              <span
                className="big-rating"
                style={{ backgroundColor: getRatingColor(facility.overall_rating) }}
              >
                {facility.overall_rating || '?'}
              </span>
            </div>
            <div className="facility-header-info">
              <h1>{facility.provider_name}</h1>
              <p className="facility-header-address">
                <MapPin size={14} />
                {facility.address}, {facility.city}, {facility.state} {facility.zip_code}
              </p>
              <div className="facility-header-meta">
                <span className="meta-item">
                  <Building2 size={14} /> {beds} Beds
                </span>
                <span className="meta-item">
                  <Users size={14} /> {occupancy}% Occupancy
                </span>
                <span className="meta-item">
                  CCN: {facility.ccn}
                </span>
                {facility.ownership_type && (
                  <span className="ownership-badge">{facility.ownership_type}</span>
                )}
              </div>
            </div>
          </div>
          <div className="facility-header-actions">
            <button
              className={`btn ${isSaved ? 'btn-saved' : 'btn-secondary'}`}
              onClick={handleToggleSave}
              disabled={savingBookmark}
            >
              {savingBookmark ? (
                <Loader size={16} className="loading-spinner" />
              ) : isSaved ? (
                <BookmarkCheck size={16} />
              ) : (
                <Bookmark size={16} />
              )}
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="facility-tabs">
        <div className="facility-tabs-inner">
          <button
            className={`facility-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Building2 size={16} /> Overview
          </button>
          <button
            className={`facility-tab ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            <TrendingUp size={16} /> Historical Trends
          </button>
          <button
            className={`facility-tab ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            <Shield size={16} /> Quality & Safety
          </button>
          <button
            className={`facility-tab ${activeTab === 'financial' ? 'active' : ''}`}
            onClick={() => setActiveTab('financial')}
          >
            <DollarSign size={16} /> Financial
          </button>
          <button
            className={`facility-tab ${activeTab === 'ownership' ? 'active' : ''}`}
            onClick={() => setActiveTab('ownership')}
          >
            <Users size={16} /> Ownership
          </button>
          <button
            className={`facility-tab ${activeTab === 'competition' ? 'active' : ''}`}
            onClick={() => setActiveTab('competition')}
          >
            <Map size={16} /> Competition
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="facility-content">
        {/* ============================================= */}
        {/* OVERVIEW TAB */}
        {/* ============================================= */}
        {activeTab === 'overview' && (
          <>
            {/* Rating Cards */}
            <div className="rating-cards-grid">
              <div className="rating-card">
                <div className="rating-card-header">
                  <Star size={18} />
                  <span>Overall Rating</span>
                </div>
                <div className="rating-card-value">
                  <StarRating rating={facility.overall_rating} size={20} />
                </div>
              </div>
              <div className="rating-card">
                <div className="rating-card-header">
                  <Shield size={18} />
                  <span>Health Inspection</span>
                </div>
                <div className="rating-card-value">
                  <StarRating rating={facility.health_inspection_rating} size={20} />
                </div>
              </div>
              <div className="rating-card">
                <div className="rating-card-header">
                  <Activity size={18} />
                  <span>Quality Measures</span>
                </div>
                <div className="rating-card-value">
                  <StarRating rating={facility.qm_rating} size={20} />
                </div>
              </div>
              <div className="rating-card">
                <div className="rating-card-header">
                  <Users size={18} />
                  <span>Staffing</span>
                </div>
                <div className="rating-card-value">
                  <StarRating rating={facility.staffing_rating} size={20} />
                </div>
              </div>
            </div>

            <div className="overview-grid">
              {/* Facility Details */}
              <div className="facility-card">
                <div className="facility-card-header">
                  <h3><Building2 size={18} /> Facility Information</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Provider Number</span>
                    <span className="info-value">{facility.ccn}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Phone</span>
                    <span className="info-value">{facility.phone || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Certified Beds</span>
                    <span className="info-value">{beds}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Current Residents</span>
                    <span className="info-value">{residents}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Occupancy Rate</span>
                    <span className="info-value">{occupancy}%</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Ownership Type</span>
                    <span className="info-value">{facility.ownership_type || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">In Hospital</span>
                    <span className="info-value">{facility.provider_resides_in_hospital ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Continuing Care</span>
                    <span className="info-value">{facility.continuing_care_retirement_community ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Recent Events */}
              <div className="facility-card">
                <div className="facility-card-header">
                  <h3><Clock size={18} /> Recent Events</h3>
                </div>
                {profile.events && profile.events.length > 0 ? (
                  <div className="events-list">
                    {profile.events.slice(0, 8).map((event, idx) => (
                      <div key={idx} className="event-item">
                        <div className={`event-icon ${event.event_type}`}>
                          {event.event_type === 'rating_change' && <TrendingUp size={14} />}
                          {event.event_type === 'new_penalty' && <AlertTriangle size={14} />}
                          {event.event_type === 'new_facility' && <Building2 size={14} />}
                        </div>
                        <div className="event-content">
                          <span className="event-description">{event.event_description}</span>
                          <span className="event-date">{formatDate(event.extract_date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-small">
                    <p>No recent events recorded</p>
                  </div>
                )}
              </div>

              {/* Staffing Details */}
              <div className="facility-card">
                <div className="facility-card-header">
                  <h3><Users size={18} /> Staffing (Hours per Resident Day)</h3>
                </div>
                <div className="staffing-bars">
                  <div className="staffing-row">
                    <span className="staffing-label">RN</span>
                    <div className="staffing-bar-container">
                      <div
                        className="staffing-bar rn"
                        style={{ width: `${Math.min((parseFloat(facility.reported_rn_hrs) || 0) / 2 * 100, 100)}%` }}
                      />
                    </div>
                    <span className="staffing-value">{parseFloat(facility.reported_rn_hrs || 0).toFixed(2)}</span>
                  </div>
                  <div className="staffing-row">
                    <span className="staffing-label">LPN</span>
                    <div className="staffing-bar-container">
                      <div
                        className="staffing-bar lpn"
                        style={{ width: `${Math.min((parseFloat(facility.reported_lpn_hrs) || 0) / 2 * 100, 100)}%` }}
                      />
                    </div>
                    <span className="staffing-value">{parseFloat(facility.reported_lpn_hrs || 0).toFixed(2)}</span>
                  </div>
                  <div className="staffing-row">
                    <span className="staffing-label">CNA</span>
                    <div className="staffing-bar-container">
                      <div
                        className="staffing-bar cna"
                        style={{ width: `${Math.min((parseFloat(facility.reported_na_hrs) || 0) / 4 * 100, 100)}%` }}
                      />
                    </div>
                    <span className="staffing-value">{parseFloat(facility.reported_na_hrs || 0).toFixed(2)}</span>
                  </div>
                  <div className="staffing-row total">
                    <span className="staffing-label">Total</span>
                    <div className="staffing-bar-container">
                      <div
                        className="staffing-bar total"
                        style={{ width: `${Math.min((parseFloat(facility.reported_total_nurse_hrs) || 0) / 6 * 100, 100)}%` }}
                      />
                    </div>
                    <span className="staffing-value">{parseFloat(facility.reported_total_nurse_hrs || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* COVID Data */}
              {profile.covidData && (
                <div className="facility-card">
                  <div className="facility-card-header">
                    <h3><Shield size={18} /> COVID-19 Vaccination</h3>
                  </div>
                  <div className="covid-grid">
                    <div className="covid-item">
                      <span className="covid-label">Staff Vaccination Rate</span>
                      <span className="covid-value">
                        {profile.covidData.staff_vaccination_rate
                          ? `${parseFloat(profile.covidData.staff_vaccination_rate).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="covid-item">
                      <span className="covid-label">Staff Up-to-Date</span>
                      <span className="covid-value">
                        {profile.covidData.staff_up_to_date_rate
                          ? `${parseFloat(profile.covidData.staff_up_to_date_rate).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="covid-item">
                      <span className="covid-label">Resident Vaccination Rate</span>
                      <span className="covid-value">
                        {profile.covidData.resident_vaccination_rate
                          ? `${parseFloat(profile.covidData.resident_vaccination_rate).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="covid-item">
                      <span className="covid-label">Resident Up-to-Date</span>
                      <span className="covid-value">
                        {profile.covidData.resident_up_to_date_rate
                          ? `${parseFloat(profile.covidData.resident_up_to_date_rate).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============================================= */}
        {/* HISTORICAL TRENDS TAB - STANDARDIZED CHARTS */}
        {/* ============================================= */}
        {activeTab === 'trends' && (
          <>
            {trendsData ? (
              <div className="charts-grid">
                {/* 1. Star Rating History - Full Width */}
                <div className="chart-card full-width">
                  <div className="chart-card-header">
                    <h3><Star size={18} /> Star Rating History</h3>
                    <p className="chart-description">
                      CMS Five-Star Quality Rating combining health inspection, staffing, and quality measure scores.
                      <span className="time-period"> Updated monthly.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.ratings} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="stepAfter" dataKey="overall" name="Overall" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="health" name="Health" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="quality" name="Quality" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="staffing" name="Staffing" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Staffing Ratios */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><Users size={18} /> Staffing Ratios (HPRD)</h3>
                    <p className="chart-description">
                      Hours Per Resident Day - nursing hours provided per resident.
                      <span className="time-period"> Based on PBJ staffing data, 2-week average.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendsData.staffing} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="cna" name="CNA" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="lpn" name="LPN" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="rn" name="RN" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Occupancy Rate */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><Building2 size={18} /> Occupancy Rate</h3>
                    <p className="chart-description">
                      Average residents per day divided by certified bed count.
                      <span className="time-period"> Monthly snapshot.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendsData.occupancy} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={50} stroke="#6b7280" tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          formatter={(value) => [`${value}%`, 'Occupancy']}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Area type="monotone" dataKey="rate" name="Occupancy" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Staff Turnover */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><TrendingDown size={18} /> Staff Turnover (%)</h3>
                    <p className="chart-description">
                      Percentage of nursing staff who left the facility.
                      <span className="time-period"> Rolling 12-month calculation.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.turnover?.filter(t => t.totalNursingTurnover !== null) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          formatter={(value) => [`${value?.toFixed(1)}%`, '']}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="totalNursingTurnover" name="Total Nursing" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="rnTurnover" name="RN Only" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5. Cumulative Fines */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><DollarSign size={18} /> Cumulative Fines ($)</h3>
                    <p className="chart-description">
                      Total civil monetary penalties assessed by CMS.
                      <span className="time-period"> Cumulative total, rolling 3-year lookback.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendsData.penalties || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          width={60}
                          stroke="#6b7280"
                          tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                        />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          formatter={(value) => [`$${value?.toLocaleString()}`, 'Total Fines']}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Area type="monotone" dataKey="fineTotalDollars" name="Total Fines" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6. Penalty Counts */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><AlertTriangle size={18} /> Penalty Counts</h3>
                    <p className="chart-description">
                      Number of enforcement actions issued by CMS.
                      <span className="time-period"> Cumulative count, rolling 3-year lookback.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.penalties || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="stepAfter" dataKey="fineCount" name="Fines" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="paymentDenials" name="Payment Denials" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="totalPenalties" name="Total Penalties" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 7. Deficiency Counts */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><Shield size={18} /> Deficiency Counts</h3>
                    <p className="chart-description">
                      Health deficiencies found during surveys. Cycle 1 = most recent.
                      <span className="time-period"> Per survey cycle (typically annual).</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.deficiencies || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="stepAfter" dataKey="cycle1Total" name="Total" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="cycle1Standard" name="Standard" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="cycle1Complaint" name="Complaint" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 8. Health Survey Score */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><Activity size={18} /> Health Survey Score</h3>
                    <p className="chart-description">
                      CMS weighted score based on deficiency severity. Lower = better.
                      <span className="time-period"> Combines 3 most recent survey cycles.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendsData.deficiencies || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Area type="monotone" dataKey="totalWeightedScore" name="Weighted Score" stroke="#dc2626" fill="#dc2626" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 9. Quality Incidents */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><AlertCircle size={18} /> Quality Incidents</h3>
                    <p className="chart-description">
                      Self-reported incidents, complaints, and infection citations.
                      <span className="time-period"> Cumulative counts, rolling 3-year lookback.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.qualityIndicators || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="stepAfter" dataKey="incidents" name="Incidents" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="complaints" name="Complaints" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="infectionCitations" name="Infection" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 10. Case Mix Index */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><BarChart2 size={18} /> Case Mix Index (Acuity)</h3>
                    <p className="chart-description">
                      Resident acuity/complexity measure. Higher = sicker residents.
                      <span className="time-period"> Calculated from MDS assessments, quarterly.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.caseMix?.filter(c => c.caseMixIndex !== null) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          formatter={(value) => [value?.toFixed(2), 'Case Mix Index']}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Line type="monotone" dataKey="caseMixIndex" name="Case Mix Index" stroke="#0891b2" strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 11. Weekend Staffing */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><Clock size={18} /> Weekend Staffing (HPRD)</h3>
                    <p className="chart-description">
                      Nursing hours on Saturdays/Sundays. Often lower than weekdays.
                      <span className="time-period"> Based on PBJ staffing data, weekend average.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.weekendStaffing?.filter(w => w.weekendTotal !== null) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          formatter={(value) => [value?.toFixed(2), '']}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="weekendTotal" name="Total Nursing" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="weekendRN" name="RN Only" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 12. Bed Count & Census */}
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3><Building2 size={18} /> Bed Count & Census</h3>
                    <p className="chart-description">
                      Certified beds vs average daily resident census.
                      <span className="time-period"> Monthly snapshot.</span>
                    </p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.occupancy || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => format(new Date(d), 'MMM yy')}
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          stroke="#6b7280"
                        />
                        <YAxis tick={{ fontSize: 11 }} width={50} stroke="#6b7280" />
                        <Tooltip
                          labelFormatter={(d) => format(new Date(d), 'MMMM yyyy')}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Line type="stepAfter" dataKey="beds" name="Certified Beds" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="residents" name="Avg Residents" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <TrendingUp size={48} className="empty-state-icon" />
                <h4>No Historical Data Available</h4>
                <p>Trend data requires at least 2 snapshots over time</p>
              </div>
            )}
          </>
        )}

        {/* ============================================= */}
        {/* QUALITY & SAFETY TAB */}
        {/* ============================================= */}
        {activeTab === 'quality' && (
          <>
            {/* Summary Stats */}
            <div className="quality-summary">
              <div className="quality-stat">
                <span className="quality-stat-value">{profile.healthCitations?.length || 0}</span>
                <span className="quality-stat-label">Health Citations (3yr)</span>
              </div>
              <div className="quality-stat">
                <span className="quality-stat-value">{profile.fireCitations?.length || 0}</span>
                <span className="quality-stat-label">Fire Safety Citations (3yr)</span>
              </div>
              <div className="quality-stat">
                <span className="quality-stat-value">{profile.surveyDates?.length || 0}</span>
                <span className="quality-stat-label">Total Surveys</span>
              </div>
            </div>

            <div className="quality-grid">
              {/* Health Citations */}
              <div className="facility-card">
                <div className="facility-card-header">
                  <h3><Shield size={18} /> Health Deficiencies (F-Tags)</h3>
                </div>
                {profile.healthCitations && profile.healthCitations.length > 0 ? (
                  <div className="citations-list">
                    {profile.healthCitations.slice(0, 15).map((citation, idx) => (
                      <div key={idx} className="citation-item">
                        <div className="citation-header">
                          <span className="citation-tag">{citation.deficiency_tag}</span>
                          <span
                            className="citation-severity"
                            style={{ backgroundColor: getSeverityColor(citation.scope_severity_code) }}
                          >
                            {citation.scope_severity_code} - {getSeverityLabel(citation.scope_severity_code)}
                          </span>
                        </div>
                        <p className="citation-description">
                          {citation.deficiency_category || citation.tag_description || 'No description'}
                        </p>
                        <div className="citation-footer">
                          <span><Calendar size={12} /> {formatDate(citation.survey_date)}</span>
                          {citation.deficiency_corrected && (
                            <span className="corrected"><CheckCircle size={12} /> Corrected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-small">
                    <CheckCircle size={32} color="#22c55e" />
                    <p>No health deficiencies in the past 3 years</p>
                  </div>
                )}
              </div>

              {/* Fire Safety Citations */}
              <div className="facility-card">
                <div className="facility-card-header">
                  <h3><Flame size={18} /> Fire Safety Deficiencies (K-Tags)</h3>
                </div>
                {profile.fireCitations && profile.fireCitations.length > 0 ? (
                  <div className="citations-list">
                    {profile.fireCitations.slice(0, 15).map((citation, idx) => (
                      <div key={idx} className="citation-item">
                        <div className="citation-header">
                          <span className="citation-tag fire">{citation.deficiency_tag}</span>
                          <span
                            className="citation-severity"
                            style={{ backgroundColor: getSeverityColor(citation.scope_severity_code) }}
                          >
                            {citation.scope_severity_code} - {getSeverityLabel(citation.scope_severity_code)}
                          </span>
                        </div>
                        <p className="citation-description">
                          {citation.deficiency_category || citation.tag_description || 'No description'}
                        </p>
                        <div className="citation-footer">
                          <span><Calendar size={12} /> {formatDate(citation.survey_date)}</span>
                          {citation.deficiency_corrected && (
                            <span className="corrected"><CheckCircle size={12} /> Corrected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-small">
                    <CheckCircle size={32} color="#22c55e" />
                    <p>No fire safety deficiencies in the past 3 years</p>
                  </div>
                )}
              </div>
            </div>

            {/* Survey History */}
            <div className="facility-card">
              <div className="facility-card-header">
                <h3><Calendar size={18} /> Survey History</h3>
              </div>
              {profile.surveyDates && profile.surveyDates.length > 0 ? (
                <div className="survey-timeline">
                  {profile.surveyDates.slice(0, 20).map((survey, idx) => (
                    <div key={idx} className="survey-item">
                      <div className="survey-date">{formatDate(survey.survey_date)}</div>
                      <div className="survey-type">{survey.survey_type || 'Survey'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-small">
                  <p>No survey history available</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============================================= */}
        {/* FINANCIAL TAB */}
        {/* ============================================= */}
        {activeTab === 'financial' && (
          <>
            {/* VBP Scores */}
            <div className="facility-card">
              <div className="facility-card-header">
                <h3><Award size={18} /> Value-Based Purchasing (VBP) Performance</h3>
              </div>
              {profile.vbpScores && profile.vbpScores.length > 0 ? (
                <div className="vbp-table-container">
                  <table className="vbp-table">
                    <thead>
                      <tr>
                        <th>Fiscal Year</th>
                        <th>Ranking</th>
                        <th>Baseline Readmission</th>
                        <th>Performance Readmission</th>
                        <th>Achievement Score</th>
                        <th>Improvement Score</th>
                        <th>Incentive Multiplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.vbpScores.map((vbp, idx) => (
                        <tr key={idx}>
                          <td><strong>FY {vbp.fiscal_year}</strong></td>
                          <td>
                            {vbp.vbp_ranking ? `#${vbp.vbp_ranking.toLocaleString()}` : 'N/A'}
                          </td>
                          <td>
                            {vbp.baseline_readmission_rate
                              ? `${(parseFloat(vbp.baseline_readmission_rate) * 100).toFixed(2)}%`
                              : 'N/A'}
                          </td>
                          <td>
                            {vbp.performance_readmission_rate
                              ? `${(parseFloat(vbp.performance_readmission_rate) * 100).toFixed(2)}%`
                              : 'N/A'}
                          </td>
                          <td>{vbp.achievement_score || 'N/A'}</td>
                          <td>{vbp.improvement_score || 'N/A'}</td>
                          <td className={parseFloat(vbp.incentive_payment_multiplier) > 1 ? 'positive' : parseFloat(vbp.incentive_payment_multiplier) < 1 ? 'negative' : ''}>
                            {vbp.incentive_payment_multiplier
                              ? parseFloat(vbp.incentive_payment_multiplier).toFixed(4)
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state-small">
                  <p>No VBP data available</p>
                </div>
              )}
            </div>

            {/* Penalties */}
            <div className="facility-card">
              <div className="facility-card-header">
                <h3><AlertTriangle size={18} /> Penalty History</h3>
              </div>
              {profile.penaltyRecords && profile.penaltyRecords.length > 0 ? (
                <>
                  <div className="penalty-summary">
                    <div className="penalty-stat">
                      <span className="penalty-stat-value">
                        {formatCurrency(
                          profile.penaltyRecords.reduce((sum, p) => sum + (parseFloat(p.fine_amount) || 0), 0)
                        )}
                      </span>
                      <span className="penalty-stat-label">Total Fines</span>
                    </div>
                    <div className="penalty-stat">
                      <span className="penalty-stat-value">{profile.penaltyRecords.length}</span>
                      <span className="penalty-stat-label">Penalty Records</span>
                    </div>
                  </div>
                  <div className="penalties-list">
                    {profile.penaltyRecords.map((penalty, idx) => (
                      <div key={idx} className="penalty-item">
                        <div className="penalty-icon">
                          <DollarSign size={16} />
                        </div>
                        <div className="penalty-content">
                          <div className="penalty-header">
                            <span className="penalty-type">{penalty.penalty_type || 'Penalty'}</span>
                            <span className="penalty-amount">
                              {penalty.fine_amount ? formatCurrency(penalty.fine_amount) : 'N/A'}
                            </span>
                          </div>
                          <div className="penalty-footer">
                            <span>{formatDate(penalty.penalty_date)}</span>
                            {penalty.payment_denial_days && (
                              <span>{penalty.payment_denial_days} days payment denial</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state-small">
                  <CheckCircle size={32} color="#22c55e" />
                  <p>No penalty records found</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============================================= */}
        {/* OWNERSHIP TAB */}
        {/* ============================================= */}
        {activeTab === 'ownership' && (
          <>
            <div className="facility-card">
              <div className="facility-card-header">
                <h3><Users size={18} /> Ownership Structure</h3>
              </div>
              {profile.ownershipRecords && profile.ownershipRecords.length > 0 ? (
                <div className="ownership-list">
                  {profile.ownershipRecords.map((owner, idx) => (
                    <div key={idx} className="ownership-item">
                      <div className="ownership-icon">
                        {owner.owner_type === 'Individual' ? (
                          <Users size={20} />
                        ) : (
                          <Building2 size={20} />
                        )}
                      </div>
                      <div className="ownership-content">
                        <div className="ownership-name">{owner.owner_name || 'Unknown'}</div>
                        <div className="ownership-details">
                          <span className="ownership-type-badge">{owner.role_type || 'Owner'}</span>
                          <span className="ownership-entity">{owner.owner_type || 'Entity'}</span>
                          {owner.ownership_percentage && (
                            <span className="ownership-pct">{owner.ownership_percentage}%</span>
                          )}
                        </div>
                        {owner.association_date && (
                          <div className="ownership-date">
                            Since {formatDate(owner.association_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-small">
                  <p>No ownership records available</p>
                </div>
              )}
            </div>

            {/* Parent Organization Link */}
            {facility.parent_organization && (
              <div className="facility-card">
                <div className="facility-card-header">
                  <h3><Building2 size={18} /> Parent Organization</h3>
                </div>
                <div className="parent-org-link">
                  <span>{facility.parent_organization}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/ownership/${encodeURIComponent(facility.parent_organization)}`)}
                  >
                    View Portfolio <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================= */}
        {/* COMPETITION TAB */}
        {/* ============================================= */}
        {activeTab === 'competition' && (
          <>
            {/* Map */}
            <div className="facility-card">
              <div className="facility-card-header">
                <h3><Map size={18} /> Nearby Facilities (25 mile radius)</h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? 'Hide Map' : 'Show Map'}
                </button>
              </div>

              {showMap && (
                <div className="competition-map-container">
                  {!process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? (
                    <div className="map-placeholder">
                      <MapPin size={48} className="empty-state-icon" />
                      <p>Google Maps API key not configured</p>
                    </div>
                  ) : !mapLoaded ? (
                    <div className="map-placeholder">
                      <Loader size={32} className="loading-spinner" />
                      <p>Loading map...</p>
                    </div>
                  ) : (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter}
                      zoom={11}
                      options={{
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: true,
                      }}
                    >
                      {/* Subject facility marker */}
                      {facility.latitude && facility.longitude && (
                        <Marker
                          position={{
                            lat: parseFloat(facility.latitude),
                            lng: parseFloat(facility.longitude)
                          }}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: '#3b82f6',
                            fillOpacity: 1,
                            strokeColor: 'white',
                            strokeWeight: 3,
                            scale: 12,
                          }}
                          title={facility.facility_name + ' (Subject)'}
                        />
                      )}

                      {/* Competitor markers */}
                      {competitors.map((comp) => (
                        <Marker
                          key={comp.ccn}
                          position={{
                            lat: parseFloat(comp.latitude),
                            lng: parseFloat(comp.longitude)
                          }}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: getRatingColor(comp.overall_rating),
                            fillOpacity: 1,
                            strokeColor: selectedCompetitor?.ccn === comp.ccn ? '#1e40af' : 'white',
                            strokeWeight: 2,
                            scale: 8,
                          }}
                          title={comp.facility_name}
                          onClick={() => setSelectedCompetitor(comp)}
                        />
                      ))}

                      {selectedCompetitor && (
                        <InfoWindow
                          position={{
                            lat: parseFloat(selectedCompetitor.latitude),
                            lng: parseFloat(selectedCompetitor.longitude)
                          }}
                          onCloseClick={() => setSelectedCompetitor(null)}
                        >
                          <div className="map-info-window">
                            <h4>{selectedCompetitor.facility_name}</h4>
                            <p>{selectedCompetitor.city}, {selectedCompetitor.state}</p>
                            <div className="map-info-details">
                              <span>{selectedCompetitor.number_of_certified_beds} beds</span>
                              <span>{parseFloat(selectedCompetitor.distance_miles).toFixed(1)} mi</span>
                            </div>
                            <StarRating rating={selectedCompetitor.overall_rating} size={12} />
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  )}
                </div>
              )}
            </div>

            {/* Competitors Table */}
            <div className="facility-card">
              <div className="facility-card-header">
                <h3><BarChart2 size={18} /> Competitive Comparison</h3>
              </div>
              {competitors.length > 0 ? (
                <div className="competitors-table-container">
                  <table className="competitors-table">
                    <thead>
                      <tr>
                        <th>Facility</th>
                        <th>Distance</th>
                        <th>Overall</th>
                        <th>Health</th>
                        <th>Quality</th>
                        <th>Staffing</th>
                        <th>Beds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Subject facility row */}
                      <tr className="subject-row">
                        <td>
                          <strong>{facility.facility_name}</strong>
                          <span className="subject-badge">Subject</span>
                        </td>
                        <td>-</td>
                        <td><StarRating rating={facility.overall_rating} size={12} /></td>
                        <td><StarRating rating={facility.health_inspection_rating} size={12} /></td>
                        <td><StarRating rating={facility.quality_measure_rating} size={12} /></td>
                        <td><StarRating rating={facility.staffing_rating} size={12} /></td>
                        <td>{beds}</td>
                      </tr>
                      {/* Competitor rows */}
                      {competitors.map((comp) => (
                        <tr
                          key={comp.ccn}
                          className={selectedCompetitor?.ccn === comp.ccn ? 'selected' : ''}
                          onClick={() => setSelectedCompetitor(comp)}
                        >
                          <td>
                            <a
                              href={`/facility/${comp.ccn}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/facility/${comp.ccn}`);
                              }}
                            >
                              {comp.facility_name}
                            </a>
                            <div className="comp-location">{comp.city}, {comp.state}</div>
                          </td>
                          <td>{parseFloat(comp.distance_miles).toFixed(1)} mi</td>
                          <td><StarRating rating={comp.overall_rating} size={12} /></td>
                          <td><StarRating rating={comp.health_inspection_rating} size={12} /></td>
                          <td><StarRating rating={comp.quality_measure_rating} size={12} /></td>
                          <td><StarRating rating={comp.staffing_rating} size={12} /></td>
                          <td>{comp.number_of_certified_beds || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state-small">
                  <p>No competing facilities found within 25 miles</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FacilityProfile;
