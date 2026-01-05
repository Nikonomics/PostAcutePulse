import React from "react";
import { Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import Layout from "./components/common/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import CreateUser from "./pages/CreateUser";
import EditUser from "./pages/EditUser";
import AIAssistant from "./pages/AIAssistant";
import "./styles/global.css";
import { useAuth } from "./context/UserContext";
import { GoogleMapsProvider } from "./context/GoogleMapsContext";
import { SocketProvider } from "./context/SocketContext";
import { PageContextProvider } from "./context/PageContext";
import ChatInterfaceAI from "./pages/ChatInterfaceAI";
import LocationTest from "./pages/LocationTest";
import Profile from "./pages/Profile";
import MarketAnalysis from "./pages/MarketAnalysis";
import OwnershipResearch from "./pages/OwnershipResearch";
import OwnershipProfile from "./pages/OwnershipProfile";
// Legacy imports kept for reference but no longer directly routed:
// - FacilityMetrics: now rendered inside OperatorProfile for SNF
// - HomeHealth/HomeHealthAgency: now rendered inside OperatorProfile for HHA
import SurveyAnalytics from "./pages/SurveyAnalytics";
import SavedItems from "./pages/SavedItems";
import DataDictionaryTab from "./components/DataDictionaryTab/DataDictionaryTab";
import MAIntelligence from "./pages/MAIntelligence";
import CustomReportBuilder from "./pages/CustomReportBuilder";
import OperatorProfile from "./pages/OperatorProfile";
import PennantDashboard from "./pages/PennantDashboard";
import { NationalMapView, StateDetailPage, MarketDetailPage, MarketListPage } from "./pages/MarketGrading";
import ErrorBoundary from "./components/ErrorBoundary";
import { usePageTracking } from "./analytics";

// Protected route wrapper component
// const ProtectedRoute = ({ children }) => {
//   const { isLoggedIn } = useAuth();
//   return isLoggedIn ? children : <Navigate to="/" />;
// };

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isLoggedIn, user } = useAuth(); // user contains the role data from loginUser

  if (!isLoggedIn) {
    return <Navigate to="/" />;
  }

  // If a specific role is required, check it
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect based on user role
    const redirectPath = "/dashboard";
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

// Redirect legacy facility routes to unified operator profile
const OperatorRedirect = () => {
  const { ccn } = useParams();
  const location = useLocation();
  // Preserve any query parameters (e.g., ?from=deal&dealId=123)
  const queryString = location.search || '';
  return <Navigate to={`/operator/${ccn}${queryString}`} replace />;
};

function App() {
  const { isLoggedIn } = useAuth();

  // Track page views for analytics
  usePageTracking();

  // Render auth pages if user is not authenticated
  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  // Main app layout and routes for authenticated users
  return (
    <ErrorBoundary>
    <SocketProvider>
      <GoogleMapsProvider>
        <PageContextProvider>
        <Layout>
        <Routes>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected dashboard route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Provider Search - redirects to Dashboard (which has the unified search) */}
        <Route path="/provider-search" element={<Navigate to="/dashboard" replace />} />

        {/* User Management routes */}
        <Route
          path="/user-management"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-user"
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateUser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-user/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <EditUser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute>
              <AIAssistant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-assistant/chat"
          element={
            <ProtectedRoute>
              <ChatInterfaceAI />
            </ProtectedRoute>
          }
        />
        {/* Test route for location component */}
        <Route
          path="/location-test"
          element={
            <ProtectedRoute>
              <LocationTest />
            </ProtectedRoute>
          }
        />
        {/* Profile route */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        {/* Saved Items route */}
        <Route
          path="/saved-items"
          element={
            <ProtectedRoute>
              <SavedItems />
            </ProtectedRoute>
          }
        />
        {/* Market Analysis route */}
        <Route
          path="/market-analysis"
          element={
            <ProtectedRoute>
              <MarketAnalysis />
            </ProtectedRoute>
          }
        />
        {/* Ownership Research route */}
        <Route
          path="/ownership-research"
          element={
            <ProtectedRoute>
              <OwnershipResearch />
            </ProtectedRoute>
          }
        />
        {/* Ownership Profile route */}
        <Route
          path="/ownership/:id"
          element={
            <ProtectedRoute>
              <OwnershipProfile />
            </ProtectedRoute>
          }
        />
        {/* Legacy Facility routes - redirect to unified Operator Profile */}
        <Route
          path="/facility/:ccn"
          element={
            <ProtectedRoute>
              <OperatorRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/facility-metrics/:ccn"
          element={
            <ProtectedRoute>
              <OperatorRedirect />
            </ProtectedRoute>
          }
        />
        {/* Keep /facility-metrics without CCN for search UI if needed */}
        <Route
          path="/facility-metrics"
          element={<Navigate to="/dashboard" replace />}
        />
        {/* Survey Analytics route */}
        <Route
          path="/survey-analytics"
          element={
            <ProtectedRoute>
              <SurveyAnalytics />
            </ProtectedRoute>
          }
        />
        {/* M&A Intelligence route */}
        <Route
          path="/ma-intelligence"
          element={
            <ProtectedRoute>
              <MAIntelligence />
            </ProtectedRoute>
          }
        />
        {/* Market Grading routes */}
        <Route
          path="/market-grading"
          element={
            <ProtectedRoute>
              <NationalMapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market-grading/state/:stateCode"
          element={
            <ProtectedRoute>
              <StateDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market-grading/market/:marketCode"
          element={
            <ProtectedRoute>
              <MarketDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market-grading/list"
          element={
            <ProtectedRoute>
              <MarketListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market-grading/county/:countyFips"
          element={
            <ProtectedRoute>
              <MarketDetailPage />
            </ProtectedRoute>
          }
        />
        {/* Pennant Intelligence route */}
        <Route
          path="/pennant-intelligence"
          element={
            <ProtectedRoute>
              <PennantDashboard />
            </ProtectedRoute>
          }
        />
        {/* Data Dictionary route */}
        <Route
          path="/data-dictionary"
          element={
            <ProtectedRoute>
              <DataDictionaryTab />
            </ProtectedRoute>
          }
        />
        {/* Custom Report Builder route */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <CustomReportBuilder />
            </ProtectedRoute>
          }
        />
        {/* Legacy Home Health routes - redirect to unified Operator Profile */}
        <Route
          path="/home-health"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="/home-health/:ccn"
          element={
            <ProtectedRoute>
              <OperatorRedirect />
            </ProtectedRoute>
          }
        />
        {/* Operator Profile route - Unified SNF/HHA profile */}
        <Route
          path="/operator/:ccn"
          element={
            <ProtectedRoute>
              <OperatorProfile />
            </ProtectedRoute>
          }
        />
        {/* Legacy Agency Profile route - redirects to operator profile */}
        <Route
          path="/agency/:ccn"
          element={
            <ProtectedRoute>
              <OperatorProfile />
            </ProtectedRoute>
          }
        />
        {/* Catch all route - redirect to dashboard */}
        {/* <Route path="*" element={<Navigate to="/dashboard" replace />} /> */}
      </Routes>
        </Layout>
        </PageContextProvider>
      </GoogleMapsProvider>
    </SocketProvider>
    </ErrorBoundary>
  );
}

export default App;
