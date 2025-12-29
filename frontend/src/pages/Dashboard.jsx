import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Building2,
  Star,
  MapPin,
  Plus,
  ChevronRight,
  Clock,
  TrendingUp,
  Activity,
  Loader2,
  X,
  Home
} from "lucide-react";
import * as marketService from "../api/marketService";

const Dashboard = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Watchlist state
  const [watchlists, setWatchlists] = useState([]);
  const [loadingWatchlists, setLoadingWatchlists] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [creating, setCreating] = useState(false);

  // Fetch watchlists on mount
  useEffect(() => {
    fetchWatchlists();
  }, []);

  const fetchWatchlists = async () => {
    try {
      setLoadingWatchlists(true);
      const response = await marketService.getWatchlists();
      setWatchlists(response.watchlists || []);
    } catch (err) {
      console.error("Failed to fetch watchlists:", err);
    } finally {
      setLoadingWatchlists(false);
    }
  };

  // Debounced search - uses same API as Facility Metrics
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Use marketService.searchFacilities (searches both SNF and HHA)
        const response = await marketService.searchFacilities(searchQuery, 20);
        const facilities = response.data || [];
        setSearchResults(Array.isArray(facilities) ? facilities : []);
        setShowResults(true);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle clicking outside search results
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectFacility = (facility) => {
    setShowResults(false);
    setSearchQuery("");
    // Navigate to unified operator profile page with CCN
    navigate(`/operator/${facility.ccn}`);
  };

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;

    try {
      setCreating(true);
      await marketService.createWatchlist(newWatchlistName.trim());
      setNewWatchlistName("");
      setShowCreateModal(false);
      fetchWatchlists();
    } catch (err) {
      console.error("Failed to create watchlist:", err);
    } finally {
      setCreating(false);
    }
  };

  const getRatingColor = (rating) => {
    if (!rating) return "#9ca3af";
    if (rating >= 4) return "#22c55e";
    if (rating >= 3) return "#eab308";
    if (rating >= 2) return "#f97316";
    return "#ef4444";
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
        padding: "60px 24px",
        color: "white",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "36px",
          fontWeight: "700",
          marginBottom: "12px"
        }}>
          Market Intelligence Platform
        </h1>
        <p style={{
          fontSize: "18px",
          opacity: 0.9,
          marginBottom: "32px",
          maxWidth: "600px",
          margin: "0 auto 32px"
        }}>
          Search and analyze skilled nursing facilities across the nation
        </p>

        {/* Search Bar */}
        <div
          ref={searchInputRef}
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            position: "relative"
          }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "4px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
          }}>
            <Search size={20} color="#6b7280" style={{ marginLeft: "16px" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search facilities by name, city, or state..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                padding: "16px",
                fontSize: "16px",
                backgroundColor: "transparent",
                color: "#1f2937"
              }}
            />
            {isSearching && (
              <Loader2 size={20} color="#6b7280" style={{ marginRight: "16px", animation: "spin 1s linear infinite" }} />
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowResults(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px",
                  marginRight: "8px"
                }}
              >
                <X size={18} color="#6b7280" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "white",
              borderRadius: "12px",
              marginTop: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              maxHeight: "400px",
              overflowY: "auto",
              zIndex: 50,
              textAlign: "left"
            }}>
              {searchResults.map((facility, idx) => (
                <div
                  key={facility.ccn || idx}
                  onClick={() => handleSelectFacility(facility)}
                  style={{
                    padding: "16px",
                    cursor: "pointer",
                    borderBottom: idx < searchResults.length - 1 ? "1px solid #e5e7eb" : "none",
                    transition: "background-color 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "600", color: "#1f2937" }}>
                          {facility.provider_name || facility.facility_name || facility.name}
                        </span>
                        {/* Type Badge */}
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: "600",
                          borderRadius: "12px",
                          backgroundColor: facility.type === 'HHA' ? "#d1fae5" : "#dbeafe",
                          color: facility.type === 'HHA' ? "#065f46" : "#1e40af"
                        }}>
                          {facility.type === 'HHA' ? <Home size={10} /> : <Building2 size={10} />}
                          {facility.type === 'HHA' ? 'Home Health' : 'SNF'}
                        </span>
                      </div>
                      <div style={{ fontSize: "14px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={14} />
                        {facility.city}, {facility.state}
                        {facility.certified_beds && (
                          <>
                            <span style={{ margin: "0 4px" }}>•</span>
                            <Building2 size={14} />
                            {facility.certified_beds} beds
                          </>
                        )}
                      </div>
                    </div>
                    {facility.overall_rating && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        backgroundColor: `${getRatingColor(facility.overall_rating)}15`,
                        borderRadius: "6px"
                      }}>
                        <Star size={14} color={getRatingColor(facility.overall_rating)} fill={getRatingColor(facility.overall_rating)} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: getRatingColor(facility.overall_rating) }}>
                          {facility.overall_rating}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

          {/* Watchlists Section */}
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Building2 size={22} color="#2563eb" />
                <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                  My Watchlists
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                <Plus size={16} />
                New
              </button>
            </div>

            {loadingWatchlists ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                <p style={{ marginTop: "12px" }}>Loading watchlists...</p>
              </div>
            ) : watchlists.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "40px 20px",
                backgroundColor: "#f9fafb",
                borderRadius: "8px"
              }}>
                <Building2 size={40} color="#d1d5db" style={{ marginBottom: "12px" }} />
                <p style={{ color: "#6b7280", marginBottom: "16px" }}>
                  No watchlists yet. Create one to start tracking facilities.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500"
                  }}
                >
                  Create Your First Watchlist
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {watchlists.map((watchlist) => (
                  <div
                    key={watchlist.id}
                    onClick={() => navigate(`/watchlist/${watchlist.id}`)}
                    style={{
                      padding: "16px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", color: "#1f2937", marginBottom: "4px" }}>
                        {watchlist.name}
                        {watchlist.is_primary && (
                          <span style={{
                            marginLeft: "8px",
                            fontSize: "11px",
                            padding: "2px 6px",
                            backgroundColor: "#dbeafe",
                            color: "#2563eb",
                            borderRadius: "4px"
                          }}>
                            Primary
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280" }}>
                        {watchlist.items?.length || 0} facilities
                      </div>
                    </div>
                    <ChevronRight size={18} color="#9ca3af" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Section */}
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <Clock size={22} color="#7c3aed" />
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", margin: 0 }}>
                Recent Activity
              </h2>
            </div>

            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px"
            }}>
              <Activity size={40} color="#d1d5db" style={{ marginBottom: "12px" }} />
              <p style={{ color: "#6b7280" }}>
                Your recent facility views and searches will appear here.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", marginBottom: "16px" }}>
            Quick Access
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {[
              { title: "Market Analysis", path: "/market-analysis", icon: MapPin, color: "#2563eb" },
              { title: "Survey Analytics", path: "/survey-analytics", icon: TrendingUp, color: "#7c3aed" },
              { title: "Ownership Research", path: "/ownership-research", icon: Building2, color: "#059669" }
            ].map((link) => (
              <div
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  padding: "20px",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{
                  padding: "10px",
                  backgroundColor: `${link.color}15`,
                  borderRadius: "10px"
                }}>
                  <link.icon size={22} color={link.color} />
                </div>
                <span style={{ fontWeight: "600", color: "#1f2937" }}>{link.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Watchlist Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100
        }}
        onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
              Create New Watchlist
            </h3>
            <input
              type="text"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              placeholder="Watchlist name..."
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "16px",
                boxSizing: "border-box"
              }}
              onKeyPress={(e) => e.key === "Enter" && handleCreateWatchlist()}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#f3f4f6",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "500"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWatchlist}
                disabled={creating || !newWatchlistName.trim()}
                style={{
                  padding: "10px 20px",
                  backgroundColor: creating || !newWatchlistName.trim() ? "#93c5fd" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: creating || !newWatchlistName.trim() ? "not-allowed" : "pointer",
                  fontWeight: "500"
                }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
