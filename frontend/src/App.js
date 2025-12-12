import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/common/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import CreateDeal from "./pages/CreateDeal";
import CombinedDealForm from "./pages/CombinedDealForm";
import UserManagement from "./pages/UserManagement";
import CreateUser from "./pages/CreateUser";
import EditUser from "./pages/EditUser";
import AIAssistant from "./pages/AIAssistant";
import "./styles/global.css";
import { useAuth } from "./context/UserContext";
import EditDeal from "./pages/EditDeal/EditDeal";
import DealDetail from "./pages/DealDetail";
import ChatInterfaceAI from "./pages/ChatInterfaceAI";
import EditCombinedDealForm from "./pages/EditCombinedDealForm";
import EditCombinedDeatlForm1 from "./pages/EditCombinedDeatlForm1";
import LocationTest from "./pages/LocationTest";
import CreateDealChoice from "./pages/CreateDealChoice";
import UploadDeal from "./pages/UploadDeal";
import Profile from "./pages/Profile";
import MarketAnalysis from "./pages/MarketAnalysis";
import OwnershipResearch from "./pages/OwnershipResearch";
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

function App() {
  const { isLoggedIn } = useAuth();

  // Render auth pages if user is not authenticated
  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Main app layout and routes for authenticated users
  return (
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

        {/* Protected deals routes */}
        <Route
          path="/deals"
          element={
            <ProtectedRoute>
              <Deals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/create"
          element={
            <ProtectedRoute>
              <CreateDealChoice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/upload-deal"
          element={
            <ProtectedRoute>
              <UploadDeal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/combined-deal-form"
          element={
            <ProtectedRoute>
              <CombinedDealForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/edit-combined-deal1/:id"
          element={
            <ProtectedRoute>
              <EditCombinedDealForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/edit-combined-deal/:id"
          element={
            <ProtectedRoute>
              <EditCombinedDeatlForm1 />
            </ProtectedRoute>
          }
        />
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
          path="/ai-deals"
          element={
            <ProtectedRoute>
              <AIAssistant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-deals/chat-interface-ai"
          element={
            <ProtectedRoute>
              <ChatInterfaceAI />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/edit-deal/:id"
          element={
            <ProtectedRoute>
              <EditDeal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deals/deal-detail/:id"
          element={
            <ProtectedRoute>
              <DealDetail />
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
        {/* Catch all route - redirect to dashboard */}
        {/* <Route path="*" element={<Navigate to="/dashboard" replace />} /> */}
      </Routes>
    </Layout>
  );
}

export default App;
