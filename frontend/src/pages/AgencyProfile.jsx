import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Star,
  Users,
  Bed,
  BookmarkPlus,
  Check,
  Loader2,
  AlertCircle,
  Activity,
  TrendingUp,
  Shield
} from "lucide-react";
import * as marketService from "../api/marketService";

const AgencyProfile = () => {
  const { ccn } = useParams();
  const navigate = useNavigate();

  // State
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Watchlist state
  const [watchlists, setWatchlists] = useState([]);
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch facility data
  useEffect(() => {
    const fetchFacility = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await marketService.getFacilityDetails(ccn);
        setFacility(response.facility);
      } catch (err) {
        console.error("Failed to fetch facility:", err);
        setError(err.message || "Failed to load facility details");
      } finally {
        setLoading(false);
      }
    };

    if (ccn) {
      fetchFacility();
    }
  }, [ccn]);

  // Fetch watchlists
  useEffect(() => {
    const fetchWatchlists = async () => {
      try {
        const response = await marketService.getWatchlists();
        setWatchlists(response.watchlists || []);
      } catch (err) {
        console.error("Failed to fetch watchlists:", err);
      }
    };
    fetchWatchlists();
  }, []);

  const handleSaveToWatchlist = async (watchlistId) => {
    try {
      setSaving(true);
      await marketService.addToWatchlist(watchlistId, {
        ccn: ccn,
        provider_type: "SNF",
        notes: ""
      });
      setSaveSuccess(true);
      setShowWatchlistMenu(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save to watchlist:", err);
      alert(err.message || "Failed to save to watchlist");
    } finally {
      setSaving(false);
    }
  };

  const getRatingColor = (rating) => {
    if (!rating) return "#9ca3af";
    if (rating >= 4) return "#22c55e";
    if (rating >= 3) return "#eab308";
    if (rating >= 2) return "#f97316";
    return "#ef4444";
  };

  const renderStars = (rating) => {
    const stars = [];
    const numRating = parseInt(rating) || 0;
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={18}
          color={i <= numRating ? getRatingColor(numRating) : "#e5e7eb"}
          fill={i <= numRating ? getRatingColor(numRating) : "none"}
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        color: "#6b7280"
      }}>
        <Loader2 size={40} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: "16px" }}>Loading facility details...</p>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        color: "#ef4444"
      }}>
        <AlertCircle size={48} />
        <h2 style={{ marginTop: "16px", fontSize: "20px" }}>Error Loading Facility</h2>
        <p style={{ color: "#6b7280", marginTop: "8px" }}>{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            marginTop: "24px",
            padding: "12px 24px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "500"
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!facility) return null;

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "quality", label: "Quality", icon: Star },
    { id: "market", label: "Market", icon: TrendingUp }
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "20px 24px"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              padding: "8px 0",
              marginBottom: "16px",
              fontSize: "14px"
            }}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          {/* Facility Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937", margin: 0 }}>
                  {facility.facility_name}
                </h1>
                {facility.overall_rating && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    backgroundColor: `${getRatingColor(facility.overall_rating)}15`,
                    borderRadius: "8px"
                  }}>
                    <Star
                      size={18}
                      color={getRatingColor(facility.overall_rating)}
                      fill={getRatingColor(facility.overall_rating)}
                    />
                    <span style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: getRatingColor(facility.overall_rating)
                    }}>
                      {facility.overall_rating} Star
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", color: "#6b7280", fontSize: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MapPin size={16} />
                  {facility.address}, {facility.city}, {facility.state} {facility.zip_code}
                </div>
                {facility.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Phone size={16} />
                    {facility.phone}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Building2 size={16} />
                  CCN: {facility.ccn}
                </div>
              </div>
            </div>

            {/* Save to Watchlist Button */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 20px",
                  backgroundColor: saveSuccess ? "#22c55e" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: "500",
                  fontSize: "14px",
                  transition: "background-color 0.2s"
                }}
              >
                {saving ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : saveSuccess ? (
                  <Check size={18} />
                ) : (
                  <BookmarkPlus size={18} />
                )}
                {saveSuccess ? "Saved!" : "Save to Watchlist"}
              </button>

              {/* Watchlist Dropdown */}
              {showWatchlistMenu && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "8px",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  minWidth: "220px",
                  zIndex: 50
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280" }}>
                      Select Watchlist
                    </span>
                  </div>
                  {watchlists.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                      No watchlists yet.
                      <button
                        onClick={() => navigate("/dashboard")}
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "8px",
                          padding: "8px",
                          backgroundColor: "#f3f4f6",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "14px"
                        }}
                      >
                        Create Watchlist
                      </button>
                    </div>
                  ) : (
                    watchlists.map((wl) => (
                      <div
                        key={wl.id}
                        onClick={() => handleSaveToWatchlist(wl.id)}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          transition: "background-color 0.15s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <div style={{ fontWeight: "500", color: "#1f2937" }}>{wl.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          {wl.items?.length || 0} facilities
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", marginTop: "24px" }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 20px",
                  backgroundColor: activeTab === tab.id ? "#2563eb" : "transparent",
                  color: activeTab === tab.id ? "white" : "#6b7280",
                  border: activeTab === tab.id ? "none" : "1px solid #e5e7eb",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "500",
                  fontSize: "14px",
                  transition: "all 0.15s"
                }}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Capacity Card */}
            <div style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Bed size={20} color="#2563eb" />
                Capacity & Census
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
                    {facility.total_beds || "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Certified Beds</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
                    {facility.resident_count || "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Current Residents</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
                    {facility.avg_daily_census ? Math.round(facility.avg_daily_census) : "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Avg Daily Census</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
                    {facility.total_beds && facility.avg_daily_census
                      ? `${Math.round((facility.avg_daily_census / facility.total_beds) * 100)}%`
                      : "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Occupancy Rate</div>
                </div>
              </div>
            </div>

            {/* Ownership Card */}
            <div style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={20} color="#7c3aed" />
                Ownership Information
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Ownership Type</div>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
                    {facility.ownership_type || "Not specified"}
                  </div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>County</div>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
                    {facility.county || "Not specified"}
                  </div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Last Updated</div>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
                    {facility.last_updated
                      ? new Date(facility.last_updated).toLocaleDateString()
                      : "Not available"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quality Tab */}
        {activeTab === "quality" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Star Ratings Card */}
            <div style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Star size={20} color="#eab308" />
                CMS Star Ratings
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ color: "#6b7280" }}>Overall Rating</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {renderStars(facility.overall_rating)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ color: "#6b7280" }}>Health Inspection</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {renderStars(facility.health_inspection_rating)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ color: "#6b7280" }}>Staffing</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {renderStars(facility.staffing_rating)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
                  <span style={{ color: "#6b7280" }}>Quality Measures</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {renderStars(facility.qm_rating)}
                  </div>
                </div>
              </div>
            </div>

            {/* Deficiencies Card */}
            <div style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={20} color="#ef4444" />
                Survey Deficiencies
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "16px", backgroundColor: "#fef2f2", borderRadius: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444" }}>
                    {facility.number_of_health_deficiencies ?? "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Health Deficiencies</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#fef2f2", borderRadius: "8px" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444" }}>
                    {facility.number_of_fire_safety_deficiencies ?? "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Fire Safety Deficiencies</div>
                </div>
              </div>
              {facility.total_weighted_health_survey_score && (
                <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                    Weighted Health Survey Score
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#1f2937" }}>
                    {facility.total_weighted_health_survey_score}
                  </div>
                </div>
              )}
            </div>

            {/* Staffing Card */}
            <div style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              gridColumn: "1 / -1"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={20} color="#059669" />
                Staffing Metrics
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                <div style={{ padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#059669" }}>
                    {facility.total_nurse_hrs_per_resident ? facility.total_nurse_hrs_per_resident.toFixed(2) : "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Total Nurse Hrs/Res/Day</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#059669" }}>
                    {facility.rn_hrs_per_resident ? facility.rn_hrs_per_resident.toFixed(2) : "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>RN Hrs/Res/Day</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#d97706" }}>
                    {facility.total_nursing_staff_turnover
                      ? `${facility.total_nursing_staff_turnover.toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Total Nursing Turnover</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#d97706" }}>
                    {facility.registered_nurse_turnover
                      ? `${facility.registered_nurse_turnover.toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>RN Turnover</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Market Tab */}
        {activeTab === "market" && (
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "40px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            textAlign: "center"
          }}>
            <TrendingUp size={48} color="#d1d5db" style={{ marginBottom: "16px" }} />
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", marginBottom: "8px" }}>
              Market Analysis Coming Soon
            </h3>
            <p style={{ color: "#6b7280", maxWidth: "400px", margin: "0 auto" }}>
              Market demographics, competitive analysis, and regional benchmarks will be available here.
            </p>
            <button
              onClick={() => navigate(`/market-analysis?state=${facility.state}&county=${facility.county}`)}
              style={{
                marginTop: "24px",
                padding: "12px 24px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              View {facility.county} County Analysis
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AgencyProfile;
