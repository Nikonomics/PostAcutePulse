import { apiService } from "./apiService";
import apiRoutes from "./apiRoutes";
import axios from "axios";

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
