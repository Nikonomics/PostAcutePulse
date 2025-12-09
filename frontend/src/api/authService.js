import { apiService } from "./apiService";
import apiRoutes from "./apiRoutes";
import axios from "axios";

// Sign Up API
export const signUp = async (userData) => {
  try {
    const response = await apiService.post(apiRoutes.signUp, userData);
    localStorage.setItem("authToken", response.data.body.token);
    localStorage.setItem("authUser", JSON.stringify(response.data.body.user));
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Registration failed");
  }
};

// Login API
export const login = async (email, password) => {
  try {
    const response = await apiService.post(apiRoutes.login, {
      email,
      password,
    });
    localStorage.setItem("authToken", response.data.body.token);
    localStorage.setItem("refreshToken", response.data.body.refresh); // Store refresh token
    localStorage.setItem("authUser", JSON.stringify(response.data.body.user));
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data.message || "Login failed");
  }
};

// Get Active Users
export const getActiveUsers = async () => {
  const response = await apiService.get(apiRoutes.getActiveUsers);
  return response.data;
};

// File Upload
export const fileUpload = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiService.post(apiRoutes.fileUpload, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Check if token is expired (optional utility function)
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    // Decode JWT token to check expiration
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    // If token is malformed, consider it expired
    return true;
  }
};

// Generate Access Token (Refresh Token)
export const generateAccessToken = async (refreshToken) => {
  try {    
    // Use axios directly to avoid circular dependency
    const response = await axios.get(apiRoutes.generateAccessToKen, {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Logout
export const logout = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authUser");
  window.location.reload("/");
};

// Get my profile details
export const getMyProfileDetails = async () => {
  const response = await apiService.get(apiRoutes.getUserById);
  return response.data;
};

// Update profile
export const updateProfile = async (profileData) => {
  const response = await apiService.put(apiRoutes.updateProfile, profileData);
  // Update localStorage with new user data
  if (response.data.body) {
    const currentUser = JSON.parse(localStorage.getItem("authUser") || "{}");
    const updatedUser = { ...currentUser, ...response.data.body };
    localStorage.setItem("authUser", JSON.stringify(updatedUser));
  }
  return response.data;
};

// Change password
export const changePassword = async (currentPassword, newPassword) => {
  const response = await apiService.put(apiRoutes.changePassword, {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
};

// Get pending users (admin only)
export const getPendingUsers = async () => {
  const response = await apiService.get(apiRoutes.pendingUsers);
  return response.data;
};

// Approve user (admin only)
export const approveUser = async (userId) => {
  const response = await apiService.post(`${apiRoutes.approveUser}/${userId}`);
  return response.data;
};

// Reject user (admin only)
export const rejectUser = async (userId, reason) => {
  const response = await apiService.post(`${apiRoutes.rejectUser}/${userId}`, { reason });
  return response.data;
};

// Get notifications
export const getNotifications = async (unreadOnly = false, limit = 20) => {
  const params = new URLSearchParams();
  if (unreadOnly) params.append("unread_only", "true");
  params.append("limit", limit.toString());
  const response = await apiService.get(`${apiRoutes.notifications}?${params}`);
  return response.data;
};

// Get notification count
export const getNotificationCount = async () => {
  const response = await apiService.get(apiRoutes.notificationCount);
  return response.data;
};

// Mark notifications as read
export const markNotificationsRead = async (notificationIds = null, markAll = false) => {
  const response = await apiService.put(apiRoutes.markNotificationsRead, {
    notification_ids: notificationIds,
    mark_all: markAll,
  });
  return response.data;
};
