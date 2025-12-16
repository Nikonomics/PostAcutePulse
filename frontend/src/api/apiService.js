import axios from "axios";
import { generateAccessToken } from "./authService";

// Create an Axios instance
const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 500000,
  // headers: {
  //   "Content-Type": "application/json",
  // },
});

// Add request interceptor for authentication
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const refreshToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    const response = await generateAccessToken(refreshToken);

    console.log("Token refresh response:", response);

    // Try different possible response structures
    // Response structure: { success, code, message, body: { token, accessToken, access_token } }
    let newToken = response.body?.token || response.body?.accessToken || response.body?.access_token;

    if (newToken) {
      console.log("New token extracted successfully");
      localStorage.setItem("authToken", newToken);
      return newToken;
    } else {
      console.error("Failed to extract token from response:", response);
      throw new Error("Token not found in response");
    }
  } catch (error) {
    // Only logout if it's a 401 (refresh token expired)
    if (
      error.response?.status === 401 ||
      error.response?.data?.status_code === 401
    ) {
      console.log("🚪 Refresh token expired, redirecting to login");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("authToken");
      window.location.href = "/Login";
    } else {
      console.log(
        "⚠️ Token refresh failed but not due to expired refresh token"
      );
    }

    throw new Error("Failed to refresh token");
  }
};

// Add response interceptor for error handling and token refresh
API.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const originalRequest = config;

    console.log("API Error:", response?.status, error.message);

    if (response?.status === 401 && !originalRequest._retry) {
      console.log("401 Unauthorized detected, attempting token refresh...");
      originalRequest._retry = true;

      try {
        const newToken = await refreshToken();
        console.log("Token refreshed successfully, retrying original request");
        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Handle token refresh failure
        console.error("Token refresh failed:", refreshError);
        // Redirect to login or handle as needed
        return Promise.reject(refreshError);
      }
    }

    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Export reusable API methods
export const apiService = {
  get: (url, params) => API.get(url, { params }),
  post: (url, data) => API.post(url, data),
  put: (url, data) => API.put(url, data),
  delete: (url) => API.delete(url),
};
