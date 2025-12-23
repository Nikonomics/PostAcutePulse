import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Star, Users, AlertCircle, DollarSign,
  Loader, ArrowLeft, Edit2, Save, X, Plus, Trash2, Mail,
  Phone, Globe, Linkedin, MessageSquare, Clock, ChevronRight,
  Send, User, Bookmark, BookmarkCheck, Map, TrendingUp, TrendingDown,
  ArrowRightLeft, ExternalLink, Activity, ClipboardList
} from 'lucide-react';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import {
  getOwnershipProfile,
  updateOwnershipProfile,
  getOwnershipContacts,
  addOwnershipContact,
  updateOwnershipContact,
  deleteOwnershipContact,
  getOwnershipComments,
  addOwnershipComment,
  deleteOwnershipComment,
  getOwnershipActivity
} from '../api/ownershipService';
import { getOwnerHistory } from '../api/maAnalyticsService';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getCompanySurveyAnalytics, getDeficiencyDetails } from '../api/surveyService';
import {
  saveOwnershipGroup,
  checkSavedItems,
  removeSavedItem
} from '../api/savedItemsService';
import { useAuth } from '../context/UserContext';
import { useGoogleMaps } from '../context/GoogleMapsContext';
import MentionInput from '../components/common/MentionInput';
import './OwnershipProfile.css';

function OwnershipProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [profile, setProfile] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [surveyData, setSurveyData] = useState(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyPeriod, setSurveyPeriod] = useState('12months');
  const [ftagModal, setFtagModal] = useState({ open: false, loading: false, data: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [stateFilter, setStateFilter] = useState('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [saving, setSaving] = useState(false);

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactFormData, setContactFormData] = useState({
    first_name: '',
    last_name: '',
    title: '',
    email: '',
    phone: '',
    mobile: '',
    linkedin_url: '',
    contact_type: 'other',
    is_primary: false,
    notes: ''
  });

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Map state
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [showMap, setShowMap] = useState(true);

  // Acquisition history state
  const [acquisitionHistory, setAcquisitionHistory] = useState(null);
  const [acquisitionLoading, setAcquisitionLoading] = useState(false);

  // Use shared Google Maps context
  const { isLoaded: mapLoaded } = useGoogleMaps();

  // Save/bookmark state
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState(null);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Load profile data
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOwnershipProfile(id);
      setProfile(data.profile);
      setFacilities(data.facilities || []);
      setContacts(data.contacts || []);
      setEditedProfile(data.profile || {});
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load ownership profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load comments
  const loadComments = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const data = await getOwnershipComments(profile.id);
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [profile?.id]);

  // Load activity
  const loadActivity = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const data = await getOwnershipActivity(profile.id, { limit: 20 });
      setActivity(data.activity || []);
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  }, [profile?.id]);

  // Load acquisition history
  const loadAcquisitionHistory = useCallback(async () => {
    if (!profile?.parent_organization) return;
    try {
      setAcquisitionLoading(true);
      const data = await getOwnerHistory({ ownerName: profile.parent_organization });
      if (data.success) {
        setAcquisitionHistory(data);
      }
    } catch (err) {
      console.error('Failed to load acquisition history:', err);
    } finally {
      setAcquisitionLoading(false);
    }
  }, [profile?.parent_organization]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Load acquisition history when profile loads
  useEffect(() => {
    if (profile?.parent_organization) {
      loadAcquisitionHistory();
    }
  }, [profile?.parent_organization, loadAcquisitionHistory]);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadComments();
      loadActivity();
    }
  }, [activeTab, loadComments, loadActivity]);

  // Load survey analytics when surveys tab is active or period changes
  useEffect(() => {
    const loadSurveyData = async () => {
      if (activeTab !== 'surveys' || !profile?.parent_organization) return;

      setSurveyLoading(true);
      try {
        const result = await getCompanySurveyAnalytics(profile.parent_organization, surveyPeriod);
        if (result.success) {
          setSurveyData(result.data);
        }
      } catch (err) {
        console.error('Error loading survey analytics:', err);
      } finally {
        setSurveyLoading(false);
      }
    };
    loadSurveyData();
  }, [activeTab, profile?.parent_organization, surveyPeriod]);

  // Handle F-tag click to show modal with description
  const handleFTagClick = async (ftagCode) => {
    setFtagModal({ open: true, loading: true, data: null });
    try {
      const result = await getDeficiencyDetails(ftagCode);
      if (result.success) {
        setFtagModal({ open: true, loading: false, data: result.data });
      } else {
        setFtagModal({ open: true, loading: false, data: { tag: ftagCode, description: 'No description available', category: 'Unknown' } });
      }
    } catch (err) {
      console.error('Error loading F-tag details:', err);
      setFtagModal({ open: true, loading: false, data: { tag: ftagCode, description: 'Failed to load description', category: 'Unknown' } });
    }
  };

  // Check if profile is saved when it loads
  useEffect(() => {
    const checkIfSaved = async () => {
      if (!profile?.parent_organization) return;
      try {
        const result = await checkSavedItems('ownership_group', {
          names: [profile.parent_organization]
        });
        if (result.success && result.saved_items) {
          const savedItem = result.saved_items[profile.parent_organization];
          if (savedItem) {
            setIsSaved(true);
            setSavedItemId(savedItem.id);
          }
        }
      } catch (err) {
        console.error('Failed to check saved status:', err);
      }
    };
    checkIfSaved();
  }, [profile?.parent_organization]);

  // Toggle save/bookmark status
  const handleToggleSave = async () => {
    if (!profile?.parent_organization) return;

    setSavingBookmark(true);
    try {
      if (isSaved && savedItemId) {
        await removeSavedItem(savedItemId);
        setIsSaved(false);
        setSavedItemId(null);
        toast.success('Removed from saved items');
      } else {
        const result = await saveOwnershipGroup(profile.parent_organization);
        if (result.success) {
          setIsSaved(true);
          setSavedItemId(result.saved_item?.id);
          toast.success('Added to saved items');
        } else if (result.alreadySaved) {
          setIsSaved(true);
          setSavedItemId(result.saved_item_id);
          toast.info('Already in saved items');
        }
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
      toast.error('Failed to update saved status');
    } finally {
      setSavingBookmark(false);
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await updateOwnershipProfile(profile.id, editedProfile);
      setProfile({ ...profile, ...editedProfile });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  // Contact form handlers
  const handleOpenContactForm = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setContactFormData(contact);
    } else {
      setEditingContact(null);
      setContactFormData({
        first_name: '',
        last_name: '',
        title: '',
        email: '',
        phone: '',
        mobile: '',
        linkedin_url: '',
        contact_type: 'other',
        is_primary: false,
        notes: ''
      });
    }
    setShowContactForm(true);
  };

  const handleSaveContact = async () => {
    try {
      if (editingContact) {
        await updateOwnershipContact(profile.id, editingContact.id, contactFormData);
        setContacts(contacts.map(c => c.id === editingContact.id ? { ...c, ...contactFormData } : c));
        toast.success('Contact updated');
      } else {
        const result = await addOwnershipContact(profile.id, contactFormData);
        setContacts([...contacts, result.contact]);
        toast.success('Contact added');
      }
      setShowContactForm(false);
    } catch (err) {
      console.error('Failed to save contact:', err);
      toast.error('Failed to save contact');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await deleteOwnershipContact(profile.id, contactId);
      setContacts(contacts.filter(c => c.id !== contactId));
      toast.success('Contact deleted');
    } catch (err) {
      console.error('Failed to delete contact:', err);
      toast.error('Failed to delete contact');
    }
  };

  // Comment handlers
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      await addOwnershipComment(profile.id, { comment: newComment });
      setNewComment('');
      await loadComments();
      await loadActivity();
      toast.success('Comment added');
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteOwnershipComment(profile.id, commentId);
      await loadComments();
      await loadActivity();
      toast.success('Comment deleted');
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('Failed to delete comment');
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

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  };

  const getActivityIcon = (changeType) => {
    if (changeType.includes('contact')) return 'contact';
    if (changeType.includes('comment')) return 'comment';
    return 'update';
  };

  // Get unique states for filter
  const states = [...new Set(facilities.map(f => f.state))].sort();
  const filteredFacilities = stateFilter === 'all'
    ? facilities
    : facilities.filter(f => f.state === stateFilter);

  // Facilities with valid coordinates for map
  const mappableFacilities = useMemo(() =>
    filteredFacilities.filter(f => f.latitude && f.longitude && !isNaN(f.latitude) && !isNaN(f.longitude)),
    [filteredFacilities]
  );

  // Calculate map center from facilities
  const mapCenter = useMemo(() => {
    if (mappableFacilities.length === 0) {
      return { lat: 39.8283, lng: -98.5795 }; // Center of US
    }
    const avgLat = mappableFacilities.reduce((sum, f) => sum + parseFloat(f.latitude), 0) / mappableFacilities.length;
    const avgLng = mappableFacilities.reduce((sum, f) => sum + parseFloat(f.longitude), 0) / mappableFacilities.length;
    return { lat: avgLat, lng: avgLng };
  }, [mappableFacilities]);

  // Color scheme for star ratings
  const getRatingColor = (rating) => {
    const colors = {
      5: '#22c55e', // Green
      4: '#84cc16', // Light green
      3: '#eab308', // Yellow
      2: '#f97316', // Orange
      1: '#ef4444', // Red
    };
    return colors[rating] || '#9ca3af'; // Gray for no rating
  };

  // Fit map bounds to show all markers
  const onMapLoad = useCallback((map) => {
    if (mappableFacilities.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      mappableFacilities.forEach(f => {
        bounds.extend({ lat: parseFloat(f.latitude), lng: parseFloat(f.longitude) });
      });
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [mappableFacilities]);

  // Loading state
  if (loading) {
    return (
      <div className="ownership-profile-page">
        <div className="loading-container">
          <Loader size={48} className="loading-spinner" />
          <p>Loading ownership profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="ownership-profile-page">
        <div className="error-container">
          <AlertCircle size={48} color="#dc2626" />
          <h3>Failed to load profile</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const totalFacilities = profile.facility_count || 0;
  // Backend returns nested objects - access them correctly
  const ratingDistribution = {
    five: profile.rating_distribution?.five_star || profile.five_star_count || 0,
    four: profile.rating_distribution?.four_star || profile.four_star_count || 0,
    three: profile.rating_distribution?.three_star || profile.three_star_count || 0,
    two: profile.rating_distribution?.two_star || profile.two_star_count || 0,
    one: profile.rating_distribution?.one_star || profile.one_star_count || 0
  };
  // Access nested ratings - backend returns nested objects
  const avgOverallRating = profile.ratings?.avg_overall || profile.avg_overall_rating;
  const avgHealthInspection = profile.ratings?.avg_health_inspection || profile.avg_health_inspection_rating;
  const avgQualityMeasure = profile.ratings?.avg_quality_measure || profile.avg_quality_measure_rating;
  const avgStaffing = profile.ratings?.avg_staffing || profile.avg_staffing_rating;
  const avgDeficiencies = profile.deficiencies?.avg_per_facility || profile.avg_health_deficiencies_per_facility;
  const totalPenaltiesAmount = profile.penalties?.total_amount || profile.total_penalties_amount;
  const totalPenaltiesCount = profile.penalties?.total_count || profile.total_penalties_count;

  return (
    <div className="ownership-profile-page">
      {/* Header */}
      <div className="ownership-header">
        <div className="ownership-header-content">
          <div className="ownership-header-left">
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
            <div className="ownership-header-icon">
              <Building2 size={24} />
            </div>
            <div className="ownership-header-info">
              <h1>{profile.parent_organization}</h1>
              <p className="ownership-header-subtitle">
                {profile.facility_count} facilities across {profile.state_count} states
              </p>
              <div className="ownership-badges">
                {profile.is_cms_sourced ? (
                  <span className="cms-badge">CMS Data</span>
                ) : (
                  <span className="cms-badge custom-badge">Custom Profile</span>
                )}
              </div>
            </div>
          </div>
          <div className="ownership-header-actions">
            <button
              className={`btn ${isSaved ? 'btn-saved' : 'btn-secondary'}`}
              onClick={handleToggleSave}
              disabled={savingBookmark}
              title={isSaved ? 'Remove from saved items' : 'Save to watch list'}
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
            {isEditing ? (
              <>
                <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                  <X size={16} /> Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                <Edit2 size={16} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ownership-tabs">
        <div className="ownership-tabs-inner">
          <button
            className={`ownership-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`ownership-tab ${activeTab === 'facilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('facilities')}
          >
            Facilities ({facilities.length})
          </button>
          <button
            className={`ownership-tab ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts ({contacts.length})
          </button>
          <button
            className={`ownership-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
          <button
            className={`ownership-tab ${activeTab === 'surveys' ? 'active' : ''}`}
            onClick={() => setActiveTab('surveys')}
          >
            <ClipboardList size={16} style={{ marginRight: '6px' }} />
            Survey Analytics
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="ownership-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Metrics */}
            <div className="ownership-metrics-grid">
              <div className="ownership-metric-card">
                <div className="ownership-metric-icon blue">
                  <Building2 size={20} />
                </div>
                <div className="ownership-metric-content">
                  <span className="ownership-metric-value">{profile.facility_count}</span>
                  <span className="ownership-metric-label">Facilities</span>
                </div>
              </div>
              <div className="ownership-metric-card">
                <div className="ownership-metric-icon green">
                  <Users size={20} />
                </div>
                <div className="ownership-metric-content">
                  <span className="ownership-metric-value">{(profile.total_beds || 0).toLocaleString()}</span>
                  <span className="ownership-metric-label">Total Beds</span>
                </div>
              </div>
              <div className="ownership-metric-card">
                <div className="ownership-metric-icon purple">
                  <MapPin size={20} />
                </div>
                <div className="ownership-metric-content">
                  <span className="ownership-metric-value">{profile.state_count}</span>
                  <span className="ownership-metric-label">States</span>
                </div>
              </div>
              <div className="ownership-metric-card">
                <div className="ownership-metric-icon amber">
                  <Star size={20} />
                </div>
                <div className="ownership-metric-content">
                  <span className="ownership-metric-value">
                    {avgOverallRating ? parseFloat(avgOverallRating).toFixed(1) : 'N/A'}
                  </span>
                  <span className="ownership-metric-label">Avg Rating</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Company Info */}
              <div className="ownership-card">
                <div className="ownership-card-header">
                  <h3 className="ownership-card-title">
                    <Building2 size={18} /> Company Information
                  </h3>
                </div>
                <div className="ownership-info-grid">
                  <div className="ownership-info-item">
                    <span className="ownership-info-label">Website</span>
                    {isEditing ? (
                      <input
                        type="text"
                        className="editable-field-input"
                        value={editedProfile.company_website || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, company_website: e.target.value })}
                        placeholder="https://example.com"
                      />
                    ) : (
                      <span className="ownership-info-value">
                        {profile.company_website ? (
                          <a href={profile.company_website} target="_blank" rel="noopener noreferrer">
                            {profile.company_website}
                          </a>
                        ) : (
                          <span className="empty-value">Not specified</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="ownership-info-item">
                    <span className="ownership-info-label">Phone</span>
                    {isEditing ? (
                      <input
                        type="text"
                        className="editable-field-input"
                        value={editedProfile.phone || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    ) : (
                      <span className="ownership-info-value">
                        {profile.phone || <span className="empty-value">Not specified</span>}
                      </span>
                    )}
                  </div>
                  <div className="ownership-info-item">
                    <span className="ownership-info-label">Founded</span>
                    {isEditing ? (
                      <input
                        type="number"
                        className="editable-field-input"
                        value={editedProfile.founded_year || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, founded_year: e.target.value })}
                        placeholder="1990"
                      />
                    ) : (
                      <span className="ownership-info-value">
                        {profile.founded_year || <span className="empty-value">Not specified</span>}
                      </span>
                    )}
                  </div>
                  <div className="ownership-info-item">
                    <span className="ownership-info-label">Occupancy</span>
                    <span className="ownership-info-value">
                      {profile.avg_occupancy_rate ? `${parseFloat(profile.avg_occupancy_rate).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Headquarters */}
                <div style={{ marginTop: '1rem' }}>
                  <span className="ownership-info-label">Headquarters</span>
                  {isEditing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        className="editable-field-input"
                        value={editedProfile.headquarters_address || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, headquarters_address: e.target.value })}
                        placeholder="Street Address"
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="editable-field-input"
                          value={editedProfile.headquarters_city || ''}
                          onChange={(e) => setEditedProfile({ ...editedProfile, headquarters_city: e.target.value })}
                          placeholder="City"
                        />
                        <input
                          type="text"
                          className="editable-field-input"
                          value={editedProfile.headquarters_state || ''}
                          onChange={(e) => setEditedProfile({ ...editedProfile, headquarters_state: e.target.value })}
                          placeholder="State"
                          maxLength={2}
                        />
                        <input
                          type="text"
                          className="editable-field-input"
                          value={editedProfile.headquarters_zip || ''}
                          onChange={(e) => setEditedProfile({ ...editedProfile, headquarters_zip: e.target.value })}
                          placeholder="ZIP"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="ownership-info-value" style={{ display: 'block', marginTop: '0.25rem' }}>
                      {profile.headquarters_address || profile.headquarters_city ? (
                        <>
                          {profile.headquarters_address && <div>{profile.headquarters_address}</div>}
                          {profile.headquarters_city && (
                            <div>
                              {profile.headquarters_city}
                              {profile.headquarters_state && `, ${profile.headquarters_state}`}
                              {profile.headquarters_zip && ` ${profile.headquarters_zip}`}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="empty-value">Not specified</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Notes */}
                <div style={{ marginTop: '1rem' }}>
                  <span className="ownership-info-label">Notes</span>
                  {isEditing ? (
                    <textarea
                      className="editable-field-input editable-textarea"
                      value={editedProfile.notes || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, notes: e.target.value })}
                      placeholder="Add internal notes about this organization..."
                      style={{ marginTop: '0.5rem' }}
                    />
                  ) : (
                    <p className="ownership-info-value" style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                      {profile.notes || <span className="empty-value">No notes added</span>}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div style={{ marginTop: '1rem' }}>
                  <span className="ownership-info-label">Description</span>
                  {isEditing ? (
                    <textarea
                      className="editable-field-input editable-textarea"
                      value={editedProfile.company_description || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, company_description: e.target.value })}
                      placeholder="Company description..."
                      style={{ marginTop: '0.5rem' }}
                    />
                  ) : (
                    <p className="ownership-info-value" style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                      {profile.company_description || <span className="empty-value">No description</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Quality Ratings */}
              <div className="ownership-card">
                <div className="ownership-card-header">
                  <h3 className="ownership-card-title">
                    <Star size={18} /> Quality Ratings
                  </h3>
                </div>

                {/* Rating Distribution */}
                <div className="rating-breakdown">
                  {Object.entries(ratingDistribution).map(([stars, count]) => {
                    const percentage = totalFacilities > 0 ? (count / totalFacilities) * 100 : 0;
                    const starNum = { five: 5, four: 4, three: 3, two: 2, one: 1 }[stars];
                    return (
                      <div key={stars} className="rating-row">
                        <span className="rating-label">{starNum} Stars</span>
                        <div className="rating-bar-container">
                          <div className={`rating-bar ${stars}`} style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="rating-count">{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Ratings */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="ownership-info-grid">
                    <div className="ownership-info-item">
                      <span className="ownership-info-label">Health Inspection</span>
                      <span className="ownership-info-value">
                        {avgHealthInspection
                          ? parseFloat(avgHealthInspection).toFixed(1)
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="ownership-info-item">
                      <span className="ownership-info-label">Quality Measures</span>
                      <span className="ownership-info-value">
                        {avgQualityMeasure
                          ? parseFloat(avgQualityMeasure).toFixed(1)
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="ownership-info-item">
                      <span className="ownership-info-label">Staffing</span>
                      <span className="ownership-info-value">
                        {avgStaffing
                          ? parseFloat(avgStaffing).toFixed(1)
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="ownership-info-item">
                      <span className="ownership-info-label">Avg Deficiencies</span>
                      <span className="ownership-info-value">
                        {avgDeficiencies
                          ? parseFloat(avgDeficiencies).toFixed(1)
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Penalties */}
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    <DollarSign size={14} style={{ display: 'inline' }} /> Penalties
                  </h4>
                  <div className="ownership-info-grid">
                    <div className="ownership-info-item">
                      <span className="ownership-info-label">Total Amount</span>
                      <span className="ownership-info-value">
                        {formatCurrency(totalPenaltiesAmount)}
                      </span>
                    </div>
                    <div className="ownership-info-item">
                      <span className="ownership-info-label">Penalty Count</span>
                      <span className="ownership-info-value">
                        {totalPenaltiesCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acquisition History Section */}
            <div className="ownership-card acquisition-history-card">
              <div className="ownership-card-header">
                <h3 className="ownership-card-title">
                  <ArrowRightLeft size={18} /> Acquisition History
                </h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/ma-intelligence?tab=explorer&operator=${encodeURIComponent(profile.parent_organization)}`)}
                >
                  View All Transactions <ExternalLink size={12} />
                </button>
              </div>

              {acquisitionLoading ? (
                <div className="acquisition-loading">
                  <Loader size={24} className="loading-spinner" />
                  <span>Loading acquisition history...</span>
                </div>
              ) : !acquisitionHistory || (acquisitionHistory.summary?.totalAcquired === 0 && acquisitionHistory.summary?.totalDivested === 0) ? (
                <div className="acquisition-empty">
                  <ArrowRightLeft size={32} className="empty-state-icon" />
                  <p>No acquisition or divestiture activity found</p>
                  <span className="empty-state-hint">Transaction data is available from 2020 onwards</span>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="acquisition-summary-grid">
                    <div className="acquisition-summary-card acquired">
                      <div className="acquisition-summary-icon">
                        <TrendingUp size={20} />
                      </div>
                      <div className="acquisition-summary-content">
                        <span className="acquisition-summary-value">{acquisitionHistory.summary.totalAcquired}</span>
                        <span className="acquisition-summary-label">Facilities Acquired</span>
                        <span className="acquisition-summary-beds">
                          {(acquisitionHistory.summary.bedsAcquired || 0).toLocaleString()} beds
                        </span>
                      </div>
                    </div>
                    <div className="acquisition-summary-card divested">
                      <div className="acquisition-summary-icon">
                        <TrendingDown size={20} />
                      </div>
                      <div className="acquisition-summary-content">
                        <span className="acquisition-summary-value">{acquisitionHistory.summary.totalDivested}</span>
                        <span className="acquisition-summary-label">Facilities Divested</span>
                        <span className="acquisition-summary-beds">
                          {(acquisitionHistory.summary.bedsDivested || 0).toLocaleString()} beds
                        </span>
                      </div>
                    </div>
                    <div className={`acquisition-summary-card net ${acquisitionHistory.summary.netChange >= 0 ? 'positive' : 'negative'}`}>
                      <div className="acquisition-summary-icon">
                        {acquisitionHistory.summary.netChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      </div>
                      <div className="acquisition-summary-content">
                        <span className="acquisition-summary-value">
                          {acquisitionHistory.summary.netChange > 0 ? '+' : ''}{acquisitionHistory.summary.netChange}
                        </span>
                        <span className="acquisition-summary-label">Net Change</span>
                        <span className="acquisition-summary-beds">
                          {acquisitionHistory.summary.netChange >= 0 ? 'Growing' : 'Shrinking'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Year-by-Year Chart */}
                  {acquisitionHistory.byYear && acquisitionHistory.byYear.length > 0 && (
                    <div className="acquisition-chart-section">
                      <h4 className="acquisition-section-title">Activity by Year</h4>
                      <div className="acquisition-chart-container">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={acquisitionHistory.byYear} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              formatter={(value, name) => [value, name === 'acquired' ? 'Acquired' : 'Divested']}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="acquired" name="Acquired" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="divested" name="Divested" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Recent Transactions Table */}
                  {acquisitionHistory.recentTransactions && acquisitionHistory.recentTransactions.length > 0 && (
                    <div className="acquisition-transactions-section">
                      <h4 className="acquisition-section-title">Recent Transactions</h4>
                      <table className="acquisition-transactions-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Facility</th>
                            <th>Location</th>
                            <th>Type</th>
                            <th>Counterparty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acquisitionHistory.recentTransactions.slice(0, 10).map((txn, idx) => (
                            <tr key={idx} className={txn.type === 'acquired' ? 'row-acquired' : 'row-divested'}>
                              <td>{new Date(txn.date).toLocaleDateString()}</td>
                              <td>
                                <span
                                  className="facility-link"
                                  onClick={() => navigate(`/facility-metrics/${txn.ccn}?from=ownership`)}
                                >
                                  {txn.facilityName}
                                </span>
                              </td>
                              <td>{txn.city}, {txn.state}</td>
                              <td>
                                <span className={`transaction-type-badge ${txn.type}`}>
                                  {txn.type === 'acquired' ? 'Acquired' : 'Divested'}
                                </span>
                              </td>
                              <td>
                                {txn.counterparty ? (
                                  <span
                                    className="counterparty-link"
                                    onClick={() => navigate(`/ownership?search=${encodeURIComponent(txn.counterparty)}`)}
                                  >
                                    {txn.counterparty}
                                  </span>
                                ) : (
                                  <span className="no-counterparty">Unknown</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Facilities Tab */}
        {activeTab === 'facilities' && (
          <>
            {/* Facilities Map */}
            <div className="ownership-card">
              <div className="ownership-card-header">
                <h3 className="ownership-card-title">
                  <Map size={18} /> Facility Locations
                </h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? 'Hide Map' : 'Show Map'}
                </button>
              </div>

              {showMap && (
                <div className="facilities-map-container">
                  {!process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? (
                    <div className="map-placeholder">
                      <MapPin size={48} className="empty-state-icon" />
                      <p>Google Maps API key not configured</p>
                      <span className="map-placeholder-count">
                        {mappableFacilities.length} facilities with coordinates
                      </span>
                    </div>
                  ) : !mapLoaded ? (
                    <div className="map-placeholder">
                      <Loader size={32} className="loading-spinner" />
                      <p>Loading map...</p>
                    </div>
                  ) : mappableFacilities.length === 0 ? (
                    <div className="map-placeholder">
                      <MapPin size={48} className="empty-state-icon" />
                      <p>No facilities with coordinates</p>
                    </div>
                  ) : (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter}
                      zoom={4}
                      onLoad={onMapLoad}
                      options={{
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: true,
                      }}
                    >
                      {mappableFacilities.map((facility) => (
                        <Marker
                          key={facility.federal_provider_number || facility.id}
                          position={{
                            lat: parseFloat(facility.latitude),
                            lng: parseFloat(facility.longitude)
                          }}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: getRatingColor(facility.overall_rating),
                            fillOpacity: 1,
                            strokeColor: selectedFacility?.federal_provider_number === facility.federal_provider_number ? '#1e40af' : 'white',
                            strokeWeight: selectedFacility?.federal_provider_number === facility.federal_provider_number ? 3 : 2,
                            scale: selectedFacility?.federal_provider_number === facility.federal_provider_number ? 10 : 8,
                          }}
                          title={facility.facility_name}
                          onClick={() => setSelectedFacility(facility)}
                        />
                      ))}

                      {selectedFacility && (
                        <InfoWindow
                          position={{
                            lat: parseFloat(selectedFacility.latitude),
                            lng: parseFloat(selectedFacility.longitude)
                          }}
                          onCloseClick={() => setSelectedFacility(null)}
                        >
                          <div className="map-info-window">
                            <h4>{selectedFacility.facility_name}</h4>
                            <p className="map-info-location">
                              {selectedFacility.city}, {selectedFacility.state}
                            </p>
                            <div className="map-info-details">
                              <span>Beds: {selectedFacility.total_beds || 'N/A'}</span>
                              {selectedFacility.overall_rating && (
                                <span className="map-info-rating">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      size={10}
                                      fill={i < selectedFacility.overall_rating ? '#fbbf24' : 'none'}
                                      stroke={i < selectedFacility.overall_rating ? '#fbbf24' : '#d1d5db'}
                                    />
                                  ))}
                                </span>
                              )}
                            </div>
                            {selectedFacility.occupancy_rate && (
                              <p className="map-info-occupancy">
                                Occupancy: {parseFloat(selectedFacility.occupancy_rate).toFixed(0)}%
                              </p>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  )}
                </div>
              )}
            </div>

            {/* Facilities Table */}
            <div className="ownership-card">
              <div className="ownership-card-header">
                <h3 className="ownership-card-title">
                  <Building2 size={18} /> Facilities
                </h3>
              </div>

              <div className="facilities-filter-bar">
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                >
                  <option value="all">All States ({facilities.length})</option>
                  {states.map(state => (
                    <option key={state} value={state}>
                      {state} ({facilities.filter(f => f.state === state).length})
                    </option>
                  ))}
                </select>
              </div>

              <table className="facilities-table">
              <thead>
                <tr>
                  <th>Facility Name</th>
                  <th>City, State</th>
                  <th>Beds</th>
                  <th>Overall Rating</th>
                  <th>Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map(facility => (
                  <tr key={facility.federal_provider_number}>
                    <td>
                      <span
                        className="facility-name-link clickable"
                        onClick={() => navigate(`/facility-metrics/${facility.federal_provider_number}?from=ownership`)}
                        title="View facility profile"
                      >
                        {facility.facility_name}
                      </span>
                    </td>
                    <td>{facility.city}, {facility.state}</td>
                    <td>{facility.total_beds || 'N/A'}</td>
                    <td>
                      {facility.overall_rating ? (
                        <div className="stars-display">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              fill={i < facility.overall_rating ? '#fbbf24' : 'none'}
                              stroke={i < facility.overall_rating ? '#fbbf24' : '#d1d5db'}
                            />
                          ))}
                        </div>
                      ) : 'N/A'}
                    </td>
                    <td>
                      {facility.occupancy_rate
                        ? `${parseFloat(facility.occupancy_rate).toFixed(0)}%`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

              {filteredFacilities.length === 0 && (
                <div className="empty-state">
                  <Building2 size={48} className="empty-state-icon" />
                  <h4>No facilities found</h4>
                  <p>Try changing the state filter</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <>
            <div className="ownership-card">
              <div className="ownership-card-header">
                <h3 className="ownership-card-title">
                  <Users size={18} /> Key Contacts
                </h3>
                <button className="btn btn-primary btn-sm" onClick={() => handleOpenContactForm()}>
                  <Plus size={14} /> Add Contact
                </button>
              </div>

              {contacts.length > 0 ? (
                <div className="contacts-grid">
                  {contacts.map(contact => (
                    <div key={contact.id} className="contact-card">
                      {contact.is_primary && (
                        <span className="contact-primary-badge">Primary</span>
                      )}
                      <div className="contact-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="contact-avatar">
                            {getInitials(contact.first_name, contact.last_name)}
                          </div>
                          <div>
                            <h4 className="contact-name">
                              {contact.first_name} {contact.last_name}
                            </h4>
                            {contact.title && <p className="contact-title">{contact.title}</p>}
                          </div>
                        </div>
                        <span className={`contact-type-badge ${contact.contact_type}`}>
                          {contact.contact_type}
                        </span>
                      </div>
                      <div className="contact-info">
                        {contact.email && (
                          <div className="contact-info-item">
                            <Mail size={14} />
                            <a href={`mailto:${contact.email}`}>{contact.email}</a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="contact-info-item">
                            <Phone size={14} />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {contact.linkedin_url && (
                          <div className="contact-info-item">
                            <Linkedin size={14} />
                            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
                              LinkedIn Profile
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="contact-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenContactForm(contact)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Users size={48} className="empty-state-icon" />
                  <h4>No contacts added</h4>
                  <p>Add key contacts at this organization</p>
                  <button className="btn btn-primary" onClick={() => handleOpenContactForm()}>
                    <Plus size={16} /> Add First Contact
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="activity-section">
            {/* Comments */}
            <div className="ownership-card">
              <div className="ownership-card-header">
                <h3 className="ownership-card-title">
                  <MessageSquare size={18} /> Discussion
                </h3>
              </div>

              <div className="comment-form">
                <div className="comment-input-wrapper">
                  <textarea
                    className="comment-textarea"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                  />
                </div>
                <div className="comment-form-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submittingComment}
                  >
                    <Send size={14} /> {submittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>

              <div className="comments-list">
                {comments.length > 0 ? (
                  comments.map(comment => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-header">
                        <div className="comment-author">
                          <div className="comment-avatar">
                            {getInitials(comment.user?.first_name, comment.user?.last_name)}
                          </div>
                          <span className="comment-author-name">
                            {comment.user?.first_name} {comment.user?.last_name}
                          </span>
                        </div>
                        <span className="comment-time">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="comment-body">{comment.comment}</div>
                      {user?.id === comment.user_id && (
                        <div className="comment-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <MessageSquare size={32} className="empty-state-icon" />
                    <p>No comments yet. Start the discussion!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="ownership-card">
              <div className="ownership-card-header">
                <h3 className="ownership-card-title">
                  <Clock size={18} /> Activity Log
                </h3>
              </div>

              <div className="activity-feed">
                {activity.length > 0 ? (
                  activity.map(item => (
                    <div key={item.id} className="activity-item">
                      <div className={`activity-icon ${getActivityIcon(item.change_type)}`}>
                        {item.change_type.includes('contact') && <User size={16} />}
                        {item.change_type.includes('comment') && <MessageSquare size={16} />}
                        {item.change_type.includes('updated') && <Edit2 size={16} />}
                        {item.change_type === 'profile_created' && <Plus size={16} />}
                      </div>
                      <div className="activity-content">
                        <p>
                          <strong>{item.user?.first_name} {item.user?.last_name}</strong>{' '}
                          {item.change_type === 'profile_updated' && (
                            <>updated <strong>{item.field_name}</strong></>
                          )}
                          {item.change_type === 'contact_added' && (
                            <>added contact <strong>{item.metadata?.contact_name}</strong></>
                          )}
                          {item.change_type === 'contact_updated' && (
                            <>updated contact <strong>{item.metadata?.contact_name}</strong></>
                          )}
                          {item.change_type === 'contact_deleted' && (
                            <>removed contact <strong>{item.metadata?.contact_name}</strong></>
                          )}
                          {item.change_type === 'comment_added' && 'added a comment'}
                          {item.change_type === 'comment_deleted' && 'deleted a comment'}
                          {item.change_type === 'profile_created' && 'created this profile'}
                        </p>
                        <div className="activity-time">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Clock size={32} className="empty-state-icon" />
                    <p>No activity recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Survey Analytics Tab */}
        {activeTab === 'surveys' && (
          <div className="survey-analytics-section">
            {/* Period Selector */}
            <div className="survey-controls">
              <div className="period-selector">
                <span className="period-label">Time Period:</span>
                <div className="period-buttons">
                  {[
                    { value: '30days', label: '30 Days' },
                    { value: '90days', label: '90 Days' },
                    { value: '12months', label: '12 Months' },
                    { value: 'all', label: 'All Time' }
                  ].map(option => (
                    <button
                      key={option.value}
                      className={`period-btn ${surveyPeriod === option.value ? 'active' : ''}`}
                      onClick={() => setSurveyPeriod(option.value)}
                      disabled={surveyLoading}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {surveyLoading ? (
              <div className="loading-container">
                <Loader className="spin" size={32} />
                <p>Loading survey analytics...</p>
              </div>
            ) : surveyData ? (
              <>
                {/* Insights Section */}
                {surveyData.insights?.length > 0 && (
                  <div className="survey-insights">
                    {surveyData.insights.map((insight, idx) => (
                      <div key={idx} className={`insight-card ${insight.type}`}>
                        <div className="insight-icon">
                          {insight.icon === 'alert' && <AlertCircle size={16} />}
                          {insight.icon === 'trending-up' && <TrendingUp size={16} />}
                          {insight.icon === 'trending-down' && <TrendingDown size={16} />}
                          {insight.icon === 'warning' && <AlertCircle size={16} />}
                          {insight.icon === 'clock' && <Clock size={16} />}
                          {insight.icon === 'info' && <Activity size={16} />}
                        </div>
                        <span className="insight-text">{insight.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary Metrics */}
                <div className="survey-metrics-grid">
                  <div className="survey-metric-card">
                    <div className="survey-metric-icon blue">
                      <ClipboardList size={20} />
                    </div>
                    <div className="survey-metric-content">
                      <span className="survey-metric-value">{surveyData.summary?.totalSurveys || 0}</span>
                      <span className="survey-metric-label">Surveys</span>
                    </div>
                  </div>
                  <div className="survey-metric-card">
                    <div className="survey-metric-icon orange">
                      <AlertCircle size={20} />
                    </div>
                    <div className="survey-metric-content">
                      <span className="survey-metric-value">{surveyData.summary?.avgDeficienciesPerSurvey?.toFixed(1) || 0}</span>
                      <span className="survey-metric-label">Avg Deficiencies</span>
                    </div>
                  </div>
                  <div className="survey-metric-card">
                    <div className={`survey-metric-icon ${surveyData.summary?.ijRatePct > 3 ? 'red' : 'green'}`}>
                      <Activity size={20} />
                    </div>
                    <div className="survey-metric-content">
                      <span className="survey-metric-value">{surveyData.summary?.ijRatePct?.toFixed(2) || 0}%</span>
                      <span className="survey-metric-label">IJ Rate</span>
                    </div>
                  </div>
                  <div className="survey-metric-card">
                    <div className="survey-metric-icon purple">
                      <Building2 size={20} />
                    </div>
                    <div className="survey-metric-content">
                      <span className="survey-metric-value">{surveyData.summary?.facilitiesWithIJ || 0}</span>
                      <span className="survey-metric-label">Facilities w/ IJ</span>
                    </div>
                  </div>
                </div>

                {/* Year-over-Year Comparison */}
                {surveyData.yearOverYear && (
                  <div className="ownership-card yoy-comparison">
                    <div className="ownership-card-header">
                      <h3 className="ownership-card-title">
                        {surveyData.yearOverYear.changePct < 0 ? (
                          <TrendingDown size={18} className="trend-down" />
                        ) : surveyData.yearOverYear.changePct > 0 ? (
                          <TrendingUp size={18} className="trend-up" />
                        ) : null}
                        Year-over-Year Comparison
                      </h3>
                    </div>
                    <div className="yoy-content">
                      <div className="yoy-stat">
                        <span className="yoy-label">Current Year</span>
                        <span className="yoy-value">{surveyData.yearOverYear.currentYear.deficiencies} deficiencies</span>
                        <span className="yoy-sub">({surveyData.yearOverYear.currentYear.surveys} surveys, avg {surveyData.yearOverYear.currentYear.avgDefs})</span>
                      </div>
                      <div className="yoy-stat">
                        <span className="yoy-label">Prior Year</span>
                        <span className="yoy-value">{surveyData.yearOverYear.priorYear.deficiencies} deficiencies</span>
                        <span className="yoy-sub">({surveyData.yearOverYear.priorYear.surveys} surveys, avg {surveyData.yearOverYear.priorYear.avgDefs})</span>
                      </div>
                      <div className={`yoy-change ${surveyData.yearOverYear.changePct < 0 ? 'positive' : surveyData.yearOverYear.changePct > 0 ? 'negative' : ''}`}>
                        {surveyData.yearOverYear.changePct < 0 ? (
                          <TrendingDown size={16} />
                        ) : surveyData.yearOverYear.changePct > 0 ? (
                          <TrendingUp size={16} />
                        ) : null}
                        {Math.abs(surveyData.yearOverYear.changePct)}% {surveyData.yearOverYear.changePct < 0 ? 'decrease' : surveyData.yearOverYear.changePct > 0 ? 'increase' : 'no change'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Monthly Trend Chart */}
                {surveyData.monthlyTrends?.length > 0 && (
                  <div className="ownership-card">
                    <div className="ownership-card-header">
                      <h3 className="ownership-card-title">
                        <Activity size={18} /> Monthly Deficiency Trends
                      </h3>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={surveyData.monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="deficiencies" name="Deficiencies" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                          <Line type="monotone" dataKey="surveys" name="Surveys" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="survey-tables-grid">
                  {/* Top F-Tags */}
                  {surveyData.topFTags?.length > 0 && (
                    <div className="ownership-card">
                      <div className="ownership-card-header">
                        <h3 className="ownership-card-title">
                          <AlertCircle size={18} /> Top Deficiency Tags
                        </h3>
                      </div>
                      <table className="survey-table">
                        <thead>
                          <tr>
                            <th>F-Tag</th>
                            <th>Description</th>
                            <th>Count</th>
                            <th>Change</th>
                            <th>Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {surveyData.topFTags.map((ftag, idx) => (
                            <tr key={idx}>
                              <td>
                                <span
                                  className="ftag-code clickable"
                                  onClick={() => handleFTagClick(ftag.code)}
                                  title="Click for details"
                                >
                                  {ftag.code}
                                </span>
                              </td>
                              <td className="ftag-name">{ftag.name?.substring(0, 50)}{ftag.name?.length > 50 ? '...' : ''}</td>
                              <td>{ftag.count}</td>
                              <td>
                                {ftag.changePct !== 0 && (
                                  <span className={`change-pct ${ftag.changePct > 0 ? 'up' : 'down'}`}>
                                    {ftag.changePct > 0 ? '+' : ''}{ftag.changePct}%
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`trend-badge ${ftag.trend.toLowerCase()}`}>
                                  {ftag.trend === 'UP' && <TrendingUp size={12} />}
                                  {ftag.trend === 'DOWN' && <TrendingDown size={12} />}
                                  {ftag.trend}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Facility Breakdown */}
                  {surveyData.facilityBreakdown?.length > 0 && (
                    <div className="ownership-card">
                      <div className="ownership-card-header">
                        <h3 className="ownership-card-title">
                          <Building2 size={18} /> Facility Survey Status
                        </h3>
                      </div>
                      <table className="survey-table">
                        <thead>
                          <tr>
                            <th>Facility</th>
                            <th>Last Survey</th>
                            <th>Days Since</th>
                            <th>Defs</th>
                            <th>IJ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {surveyData.facilityBreakdown.map((facility, idx) => (
                            <tr
                              key={idx}
                              className="clickable-row"
                              onClick={() => navigate(`/facility-metrics/${facility.ccn}`)}
                            >
                              <td>
                                <div className="facility-name-cell">
                                  <span className="facility-name">{facility.name}</span>
                                  <span className="facility-location">{facility.city}, {facility.state}</span>
                                </div>
                              </td>
                              <td>{facility.lastSurveyDate ? new Date(facility.lastSurveyDate).toLocaleDateString() : 'N/A'}</td>
                              <td>
                                <span className={`days-badge ${facility.daysSince > 365 ? 'overdue' : facility.daysSince > 300 ? 'warning' : ''}`}>
                                  {facility.daysSince || 'N/A'}
                                </span>
                              </td>
                              <td>{facility.deficiencyCount}</td>
                              <td>
                                {facility.ijCount > 0 ? (
                                  <span className="ij-badge">{facility.ijCount}</span>
                                ) : (
                                  <span className="no-ij">0</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {surveyData.dataAsOf && (
                  <div className="data-freshness">
                    Data as of {new Date(surveyData.dataAsOf).toLocaleDateString()}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <ClipboardList size={48} className="empty-state-icon" />
                <h3>No Survey Data Available</h3>
                <p>Survey analytics will appear here once data is loaded.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="contact-form-overlay" onClick={() => setShowContactForm(false)}>
          <div className="contact-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="contact-form-header">
              <h3>{editingContact ? 'Edit Contact' : 'Add Contact'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowContactForm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="contact-form-body">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={contactFormData.first_name}
                    onChange={(e) => setContactFormData({ ...contactFormData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={contactFormData.last_name}
                    onChange={(e) => setContactFormData({ ...contactFormData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={contactFormData.title}
                  onChange={(e) => setContactFormData({ ...contactFormData, title: e.target.value })}
                  placeholder="e.g., CEO, VP of Operations"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Type</label>
                  <select
                    value={contactFormData.contact_type}
                    onChange={(e) => setContactFormData({ ...contactFormData, contact_type: e.target.value })}
                  >
                    <option value="executive">Executive</option>
                    <option value="operations">Operations</option>
                    <option value="finance">Finance</option>
                    <option value="development">Development</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <div className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={contactFormData.is_primary}
                      onChange={(e) => setContactFormData({ ...contactFormData, is_primary: e.target.checked })}
                    />
                    <span>Primary Contact</span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="form-group">
                  <label>Mobile</label>
                  <input
                    type="tel"
                    value={contactFormData.mobile}
                    onChange={(e) => setContactFormData({ ...contactFormData, mobile: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>LinkedIn URL</label>
                <input
                  type="url"
                  value={contactFormData.linkedin_url}
                  onChange={(e) => setContactFormData({ ...contactFormData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={contactFormData.notes}
                  onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <div className="contact-form-footer">
              <button className="btn btn-secondary" onClick={() => setShowContactForm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveContact}
                disabled={!contactFormData.first_name || !contactFormData.last_name}
              >
                {editingContact ? 'Update Contact' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F-Tag Details Modal */}
      {ftagModal.open && (
        <div className="contact-form-overlay" onClick={() => setFtagModal({ open: false, loading: false, data: null })}>
          <div className="ftag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ftag-modal-header">
              <h3>{ftagModal.data?.tag || 'Loading...'}</h3>
              <button className="btn btn-ghost" onClick={() => setFtagModal({ open: false, loading: false, data: null })}>
                <X size={20} />
              </button>
            </div>
            <div className="ftag-modal-body">
              {ftagModal.loading ? (
                <div className="loading-container">
                  <Loader className="spin" size={24} />
                  <p>Loading deficiency details...</p>
                </div>
              ) : ftagModal.data ? (
                <>
                  <div className="ftag-category">
                    <span className="category-label">Category:</span>
                    <span className="category-value">{ftagModal.data.category}</span>
                  </div>
                  <div className="ftag-description">
                    <span className="description-label">Description:</span>
                    <p className="description-value">{ftagModal.data.description}</p>
                  </div>
                </>
              ) : (
                <p>No details available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnershipProfile;
