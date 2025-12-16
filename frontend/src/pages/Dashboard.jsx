import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download, MapPin } from "lucide-react";
import {
  getDashboardData,
  getRecentActivity,
  updateDealStatus,
  updateDealPositions,
  getSampleLocations,
  getMapFilterOptions
} from "../api/DealService";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-toastify";
import GoogleMapComponent from "../components/ui/GoogleMap";
import DealLocationsMap from "../components/ui/DealLocationsMap";

// Helper to map API response to deals with facilities format
const mapLocationsToDeals = (locations) => {
  if (!Array.isArray(locations)) return [];

  return locations.map(location => {
    // Filter facilities with valid coordinates
    const validFacilities = (location.deal_facility || [])
      .filter(facility =>
        typeof facility.latitude === "number" &&
        typeof facility.longitude === "number" &&
        !isNaN(facility.latitude) &&
        !isNaN(facility.longitude) &&
        facility.latitude !== 0 &&
        facility.longitude !== 0
      )
      .map(facility => ({
        id: facility.id,
        facility_name: facility.facility_name || `Facility ${facility.id}`,
        address: facility.address || "",
        city: facility.city || "",
        state: facility.state || "",
        latitude: facility.latitude,
        longitude: facility.longitude,
        type: facility.type || "SNF",
        company: facility.company,
        team: facility.team,
        beds: facility.beds
      }));

    return {
      id: location.id,
      deal_name: location.deal_name || `Location ${location.id}`,
      deal_status: location.deal_status,
      source: location.source,
      deal_facility: validFacilities
    };
  }).filter(location => location.deal_facility.length > 0);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  // Drag and Drop state
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // fetch recent activity data:
  const [recentActivity, setRecentActivity] = useState([]);
  const [dealsWithFacilities, setDealsWithFacilities] = useState([]);
  const [mapFilters, setMapFilters] = useState({ status: [], serviceLine: [], company: [], team: [] });
  const [filterOptions, setFilterOptions] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Run all API calls in parallel
        const [dashboardRes, activityRes, filterOptionsRes] = await Promise.all([
          getDashboardData(),
          getRecentActivity(),
          getMapFilterOptions()
        ]);

        if (dashboardRes.code === 200) {
          setDashboardData(dashboardRes.body);
        } else {
          setError(dashboardRes.message || "Failed to fetch dashboard data");
        }

        if (activityRes.code === 200) {
          setRecentActivity(activityRes.body);
        } else {
          setError(activityRes.message || "Failed to fetch recent activity");
        }

        if (filterOptionsRes.code === 200) {
          setFilterOptions(filterOptionsRes.body);
        }
      } catch (err) {
        setError("Failed to fetch dashboard or activity data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch locations when filters change
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const hasFilters = Object.values(mapFilters).some(arr => arr.length > 0);
        console.log('Fetching locations with filters:', mapFilters);

        const res = await getSampleLocations(hasFilters ? mapFilters : {});

        // New API response format: { locations: [], filterOptions: {} }
        const locations = res.body?.locations || res.body || [];

        if (!Array.isArray(locations)) {
          console.error('Invalid API response structure:', res);
          setDealsWithFacilities([]);
          return;
        }

        const mappedLocations = mapLocationsToDeals(locations);
        setDealsWithFacilities(mappedLocations);

        // Update filter options if provided
        if (res.body?.filterOptions) {
          setFilterOptions(res.body.filterOptions);
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
        setDealsWithFacilities([]);
      }
    };
    fetchLocations();
  }, [mapFilters]);

  const handleFiltersChange = (newFilters) => {
    setMapFilters(newFilters);
  };

  // console.log('dealsWithFacilities', dealsWithFacilities);

  const handleNewDeal = () => {
    navigate("/deals/new");
  };

  const handleExport = () => {
    console.log("Export dashboard data");
  };

  // Drag and Drop functions
  const handleDragStart = (e, deal, currentStatus, index) => {
    setDraggedDeal({ ...deal, currentStatus });
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";

    // Add dragging class to body for global cursor changes
    document.body.classList.add("dragging");

    // Create a clean drag image without any transforms
    const dragImage = e.target.cloneNode(true);
    dragImage.style.opacity = "0.8";
    dragImage.style.width = e.target.offsetWidth + "px";
    dragImage.style.height = e.target.offsetHeight + "px";
    dragImage.style.transform = "none";
    dragImage.style.margin = "0";
    dragImage.style.padding = "0";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);

    // Remove the temporary element after a short delay
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 100);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  const handleDragEnter = (e, status, index) => {
    if (!draggedDeal || draggedDeal.currentStatus !== status) return;

    const updatedDeals = { ...dashboardData };

    const dealsArray = [...updatedDeals[`${status}Deals`]];
    const draggedItem = dealsArray[draggedIndex];

    // Remove dragged item
    dealsArray.splice(draggedIndex, 1);
    // Insert at new position
    dealsArray.splice(index, 0, draggedItem);

    updatedDeals[`${status}Deals`] = dealsArray;

    setDashboardData(updatedDeals);
    setDraggedIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();

    if (!draggedDeal) {
      setDraggedDeal(null);
      setIsDragging(false);
      setDragOverStatus(null);
      return;
    }

    try {
      // ✅ Reorder within the same status column
      if (draggedDeal.currentStatus === targetStatus) {
        const currentDeals = [...dashboardData[`${targetStatus}Deals`]];
        const draggedItem = currentDeals[draggedIndex];

        // Remove from old index
        currentDeals.splice(draggedIndex, 1);

        // Calculate new drop position
        const dropPosition = calculateDropPosition(e, targetStatus);

        // Insert at new index
        currentDeals.splice(dropPosition, 0, draggedItem);

        // Build new positions for ALL deals in this column
        const reorderedDeals = currentDeals.map((deal, index) => ({
          id: deal.id,
          position: index + 1,
        }));

        // 🔹 Call API with full reordered list
        const response = await updateDealPositions(reorderedDeals);

        if (response.success === true) {
          toast.success(`Deals reordered in ${targetStatus}`);

          // Optimistically update UI
          setDashboardData({
            ...dashboardData,
            [`${targetStatus}Deals`]: currentDeals,
          });
        } else {
          toast.error(response.message || "Failed to update deal positions");
        }
      }
      // ✅ Move deal to another status column
      else {
        const statusPayload = {
          id: draggedDeal.id,
          deal_status: targetStatus,
        };

        const response = await updateDealStatus(statusPayload);

        if (response.success === true) {
          toast.success(`Deal moved to ${targetStatus}`);

          // Refetch dashboard data to ensure UI is in sync with backend
          try {
            const dashboardRes = await getDashboardData();
            if (dashboardRes.code === 200) {
              setDashboardData(dashboardRes.body);
              console.log("Dashboard data refreshed after status update");
            }
          } catch (refreshError) {
            console.warn("Failed to refresh dashboard data:", refreshError);
          }
        } else {
          toast.error(response.message || "Failed to update deal status");
        }
      }
    } catch (error) {
      console.error("Error updating deal:", error);
      toast.error("Failed to update deal");
    } finally {
      setDraggedDeal(null);
      setIsDragging(false);
      setDragOverStatus(null);
    }
  };

  // Calculate the actual drop position based on mouse coordinates
  const calculateDropPosition = (e, status) => {
    const columnElement = e.currentTarget;
    const dealsContainer = columnElement.querySelector(".space-y-3");
    const dealCards = dealsContainer.querySelectorAll(".deal-card");

    if (dealCards.length === 0) return 0;

    const rect = dealsContainer.getBoundingClientRect();
    const mouseY = e.clientY;

    // Find the position where the deal should be inserted
    for (let i = 0; i < dealCards.length; i++) {
      const cardRect = dealCards[i].getBoundingClientRect();
      const cardMiddle = cardRect.top + cardRect.height / 2;

      if (mouseY < cardMiddle) {
        return i;
      }
    }

    // If dropped at the bottom, return the last position
    return dealCards.length;
  };

  // Clean up drag styles when drag ends
  const handleDragEnd = () => {
    // Reset any inline styles that might have been applied
    const draggedElements = document.querySelectorAll(".deal-card");
    draggedElements.forEach((el) => {
      el.style.opacity = "";
      el.style.transform = "";
      el.style.zIndex = "";
    });

    setDraggedDeal(null);
    setIsDragging(false);
    setDragOverStatus(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span
          className="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true"
        ></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-red-500 text-lg">{error}</span>
      </div>
    );
  }

  // Helper: Format number to 1 decimal if needed
  const formatNumber = (num, decimals = 1) => {
    if (typeof num !== "number") return num;
    return num % 1 === 0 ? num : num.toFixed(decimals);
  };

  const renderColumn = (status, color, label) => (
    <div
      className={`pipeline-column min-h-[200px] p-3 rounded-lg border border-gray-200 transition-all duration-300 ease-out ${dragOverStatus === status ? "drag-over" : "bg-gray-50"
        }`}
      data-status={status}
      onDragOver={(e) => handleDragOver(e, status)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, status)}
    >
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide border-b border-gray-200 pb-2">
        {label.toUpperCase()} ({dashboardData[`${status}Deals`]?.length || 0})
      </h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {dashboardData[`${status}Deals`]?.map((deal, index) => (
          <div
            key={deal.id}
            draggable
            onDragStart={(e) => handleDragStart(e, deal, status, index)}
            onDragEnter={(e) => handleDragEnter(e, status, index)}
            onDragEnd={handleDragEnd}
            className={`deal-card bg-${color}-100 border border-${color}-200 text-${color}-800 p-3 rounded-lg text-sm font-medium relative transition-all duration-200 ease-out ${draggedDeal?.id === deal.id ? "dragging" : ""
              }`}
            onClick={() => navigate(`/deals/deal-detail/${deal.id}`)}
          >
            <div className="flex items-center justify-between">
              <span className="truncate flex-1 mr-2">{deal.deal_name}</span>
              <span
                className={`position-badge text-xs bg-${color}-100 text-${color}-700 px-2 py-1 rounded-full font-medium flex-shrink-0`}
              >
                #{index + 1}
              </span>
            </div>
          </div>
        ))}
        {(!dashboardData[`${status}Deals`] ||
          dashboardData[`${status}Deals`].length === 0) && (
            <div className="text-gray-400 text-sm text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              Drop deals here
            </div>
          )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="row align-items-center">
          <div className="col-md-5">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600 mb-0">
              Overview of all deals and key metrics
            </p>
          </div>
          <div className="col-md-7 mt-3 mt-md-0">
            <div className="flex gap-3 justify-content-end">
              {/* <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 px-md-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download size={16} />
                Export
              </button> */}
              <button
                onClick={handleNewDeal}
                className="flex items-center gap-2 px-3 px-md-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus size={16} />
                New Deal
              </button>
              {/* <button
                onClick={() => navigate("/combined-deal-form")}
                className="flex items-center gap-2 px-3 px-md-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <Plus size={16} />
                Combined Deal Form
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Active Deals */}
        {/* <div className="bg-white rounded-lg border border-gray-200 p-6 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                ACTIVE DEALS
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {dashboardData.total_deals}
              </p>
              <p className="text-sm text-gray-500 mt-1 mb-0">
                +{dashboardData.weekly_deals} this week
              </p>
            </div>
          </div>
        </div> */}

        {/* Pipeline Value */}
        {/* <div className="bg-white rounded-lg border border-gray-200 p-6 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                PIPELINE VALUE
              </p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {formatNumber(dashboardData?.total_pipeline_revenue || 0)}M
              </p>
              <p className="text-sm text-gray-500 mt-1 mb-0">
                +{formatNumber(dashboardData?.total_pipeline_revenue || 0)}M
                this week
              </p>
            </div>
          </div>
        </div> */}

        {/* Due Diligence */}
        {/* <div className="bg-white rounded-lg border border-gray-200 p-6 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                DUE DILIGENCE
              </p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {dashboardData.due_diligence_deals}
              </p>
              <p className="text-sm text-gray-500 mt-1 mb-0">Deals in review</p>
            </div>
          </div>
        </div> */}

        {/* Avg Close Time */}
        {/* <div className="bg-white rounded-lg border border-gray-200 p-6 border-l-4 border-l-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                AVG. CLOSE TIME
              </p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {dashboardData.average_deal_close_date}d
              </p>
              <p className="text-sm text-gray-500 mt-1 mb-0">
                {dashboardData.average_deal_close_date_difference} days this
                week
              </p>
            </div>
          </div>
        </div> */}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Deal Pipeline Status */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Deal Pipeline Status
          </h3>

          {/* Equal-width 5 columns */}
          <div className="flex gap-6 w-full">
            <div className="flex-1">
              {renderColumn("pipeline", "yellow", "Pipeline")}
            </div>
            <div className="flex-1">
              {renderColumn("due_diligence", "blue", "Due Diligence")}
            </div>
            {/* <div className="flex-1">
              {renderColumn("final_review", "red", "Final Review")}
            </div> */}
            <div className="flex-1">
              {renderColumn("closed", "green", "CURRENT OPERATIONS")}
            </div>
            <div className="flex-1">
              {renderColumn("hold", "gray", "On Hold")}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {/* 
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-6">
      Recent Activity
    </h3>
    <div className="space-y-4">
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : recentActivity && recentActivity.length > 0 ? (
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div key={index} className="text-sm text-gray-700">
              <div dangerouslySetInnerHTML={{ __html: activity.message }} />
              <div className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(activity.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-sm">No recent activity</div>
      )}
    </div>
  </div>
  */}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AI Assistant */}
        <div className="bg-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">AI</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
              <p className="text-white text-sm opacity-90">
                Quick analysis and insights
              </p>
            </div>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Ask me anything about your deals..."
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-500 border-0 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
            />
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-2 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
              Analyze
            </button>
            <button className="px-3 py-2 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
              Templates
            </button>
            <button className="px-3 py-2 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
              Insights
            </button>
          </div>
        </div>

        {/* Market Benchmarks */}
        {/* <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Market Benchmarks
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Avg. Occupancy</p>
              <p className="text-2xl font-bold text-green-600">
                {formatNumber(dashboardData.average_current_occupancy)}%
              </p>
              <p className="text-xs text-gray-500">Industry avg</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Avg. Revenue/Bed</p>
              <p className="text-2xl font-bold text-blue-600">
                ${formatNumber(dashboardData.average_revenue_per_bed)}K
              </p>
              <p className="text-xs text-gray-500">Industry avg</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Risk Score</p>
              <p className="text-2xl font-bold text-red-600">0</p>
              <p className="text-xs text-gray-500">Out of 10</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Avg. Close Time</p>
              <p className="text-2xl font-bold text-orange-600">
                {dashboardData.average_deal_close_date_difference}d
              </p>
              <p className="text-xs text-gray-500">Market avg</p>
            </div>
          </div>
        </div> */}

        {/* Today's Tasks & Quick Stats */}
        <div className="space-y-6">
          {/* Today's Tasks */}
          {/* <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Today's Tasks
            </h3>
            <div className="space-y-3">
              <div className="text-gray-400 text-sm">No tasks for today</div>
            </div>
          </div> */}

          {/* Quick Stats */}
          {/* <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Beds:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {dashboardData?.total_beds?.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Portfolio Value:</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${formatNumber(dashboardData?.total_revenue)}M
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Markets:</span>
                <span className="text-sm font-semibold text-gray-900">
                  N/A
                </span>
              </div>
            </div>
          </div> */}
        </div>
      </div>

      {/* Google Maps Section */}
      <div className="mb-8">
        {/* Map with Sample Locations */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Property Locations</h3>
                <p className="text-gray-600 text-sm">Interactive map showing all deal locations</p>
              </div>
            </div>

            {/* Map Info */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {dealsWithFacilities.length} deals
              </span>
            </div>
          </div>



          <DealLocationsMap
            deals={dealsWithFacilities}
            height="500px"
            showInfoWindows={true}
            filterOptions={filterOptions}
            onFiltersChange={handleFiltersChange}
            onMarkerClick={(marker, location) => {
              // Navigate to deal detail for deal facilities
              if (location.source !== 'cascadia' && location.dealId) {
                const numericDealId = String(location.dealId).replace('deal-', '');
                navigate(`/deals/deal-detail/${numericDealId}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
