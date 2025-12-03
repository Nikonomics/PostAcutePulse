import { apiService } from "./apiService";
import apiRoutes from "./apiRoutes";

// Login API
export const createUser = async (payload) => {
  try {
    const response = await apiService.post(`${apiRoutes.createUser}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data.message || "Create User failed");
  }
};

// delete user
export const deleteUser = async (id) => {
  const response = await apiService.delete(`${apiRoutes.deleteUser}/${id}`);
  return response.data;
};

export const getUsers = async (
  page,
  limit,
  search,
  sort,
  role,
  status,
  department
) => {
  try {
    const params = new URLSearchParams();

    params.append("page", page);
    params.append("limit", limit);
    if (search) params.append("search", search);
    if (sort) params.append("sort", sort);
    if (role && role !== "All") params.append("role", role);
    if (status && status !== "All") params.append("status", status);
    if (department && department !== "All")
      params.append("department", department);

    const response = await apiService.get(
      `${apiRoutes.getUsers}?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data.message || "Get Users failed");
  }
};

export const getUserStats = async () => {
  try {
    const response = await apiService.get(`${apiRoutes.getUserStats}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data.message || "Get User Stats failed");
  }
};

// Get user by ID
export const getUserById = async (id) => {
  try {
    const response = await apiService.get(
      `${apiRoutes.getUserById}?user_id=${id}`
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data.message || "Get User failed");
  }
};

// Update user
export const updateUser = async (id, payload) => {
  try {
    const response = await apiService.put(`${apiRoutes.updateUser}`, {
      id,
      ...payload,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data.message || "Update User failed");
  }
};
