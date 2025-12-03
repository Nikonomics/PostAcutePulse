import React, { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createUser } from "../api/userService";
import { toast } from "react-toastify";
import { useAuth } from "../context/UserContext";
import * as yup from "yup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

const validationSchema = yup.object().shape({
  first_name: yup.string().required("First name is required"),
  last_name: yup.string().required("Last name is required"),
  email: yup
    .string()
    .email("Invalid email format")
    .required("Email is required"),
  phone_number: yup
    .string()
    .matches(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  department: yup.string().required("Department is required"),
  role: yup.string().required("Role is required"),
  status: yup.string().required("Status is required"),
  password: yup
    .string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
  confirm_password: yup
    .string()
    .oneOf([yup.ref("password"), null], "Passwords must match")
    .required("Confirm password is required"),
  permission: yup.string().required("Permissions are required"),
  send_welcome_email: yup.boolean(),
  email_notifications: yup.boolean(),
});

const CreateUser = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(validationSchema),
  });

  const onUserSubmit = async (formData) => {
    try {
      setIsLoading(true);
      const response = await createUser(formData);
      if (response.code == 200) {
        toast.success(response.message);
        navigate("/user-management");
        reset();
      } else {
        toast.error(response.message);
      }
    } catch (err) {
      console.log("err", err);
      toast.error(err.message || "User creation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/user-management");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Add New User
            </h1>
            <p className="text-gray-500 text-sm mb-1">
              Create a new user account with appropriate roles and permissions
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-8">
        <div className="flex gap-2 flex-wrap">
          <button className="border-0 flex items-center gap-1 px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600" onClick={() => navigate("/user-management")}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onUserSubmit)}>
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          {/* User Information Section */}
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              User Information
            </h2>

            <div className="row">
              {/* First Name */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("first_name")}
                  placeholder="Enter first name"
                  className={`w-full px-3 py-2 border ${
                    errors.first_name ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
                />
                {errors.first_name && (
                  <span className="error-message">
                    {errors.first_name.message}
                  </span>
                )}
              </div>
              {/* Last Name */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("last_name")}
                  placeholder="Enter last name"
                  className={`w-full px-3 py-2 border ${
                    errors.last_name ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
                />
                {errors.last_name && (
                  <span className="error-message">
                    {errors.last_name.message}
                  </span>
                )}
              </div>
              {/* Email Address */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register("email")}
                  placeholder="user@company.com"
                  className={`w-full px-3 py-2 border ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
                />
                {errors.email && (
                  <span className="error-message">{errors.email.message}</span>
                )}
              </div>

              {/* Phone Number */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  {...register("phone_number")}
                  placeholder="+1 (555) 000-0000"
                  className={`w-full px-3 py-2 border ${
                    errors.phone_number ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
                />
                {errors.phone_number && (
                  <span className="error-message">
                    {errors.phone_number.message}
                  </span>
                )}
              </div>
              {/* Password */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 border ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
                />
                {errors.password && (
                  <span className="error-message">
                    {errors.password.message}
                  </span>
                )}
              </div>
              {/* Confirm Password */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirm_password")}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 border ${
                    errors.confirm_password
                      ? "border-red-500"
                      : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm`}
                />
                {errors.confirm_password && (
                  <span className="error-message">
                    {errors.confirm_password.message}
                  </span>
                )}
              </div>
              {/* Role */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("role")}
                  className={`w-full px-3 py-2 border ${
                    errors.role ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white`}
                >
                  <option value="">Select role</option>
                  <option value="admin">Admin</option>
                  <option value="deal_manager">Deal Manager</option>
                  <option value="analyst">Analyst</option>
                  <option value="reviewer">Reviewer</option>
                </select>
                {errors.role && (
                  <span className="error-message">{errors.role.message}</span>
                )}
              </div>
              {/* Status */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  {...register("status")}
                  className={`w-full px-3 py-2 border ${
                    errors.status ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {errors.status && (
                  <span className="error-message">{errors.status.message}</span>
                )}
              </div>

              {/* Department */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("department")}
                  className={`w-full px-3 py-2 border ${
                    errors.department ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white`}
                >
                  <option value="">Select department</option>
                  <option value="m&a_team">M&A Team</option>
                  <option value="finance">Finance</option>
                  <option value="legal">Legal</option>
                  <option value="operations">Operations</option>
                  <option value="HR">HR</option>
                </select>
                {errors.department && (
                  <span className="error-message">
                    {errors.department.message}
                  </span>
                )}
              </div>

              {/* Permissions */}
              <div className="col-md-6 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <select
                  {...register("permission")}
                  className={`w-full px-3 py-2 border ${
                    errors.permission ? "border-red-500" : "border-gray-300"
                  } rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white`}
                >
                  <option value="standard_user">Standard User</option>
                  <option value="advanced_user">Advanced User</option>
                  <option value="administrator">Administrator</option>
                  <option value="read_only">Read Only</option>
                </select>
                {errors.permission && (
                  <span className="error-message">
                    {errors.permission.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Notification Settings
            </h2>
            <div className="d-flex flex-wrap gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendWelcomeEmail"
                  {...register("send_welcome_email")}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                />
                <label
                  htmlFor="sendWelcomeEmail"
                  className="ml-2 text-sm text-gray-700 mb-0"
                >
                  Send welcome email
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  {...register("email_notifications")}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                />
                <label
                  htmlFor="emailNotifications"
                  className="ml-2 text-sm text-gray-700 mb-0"
                >
                  Email notifications
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 text-white text-sm border-0 rounded hover:bg-gray-600"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white text-sm border-0 rounded btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
              ) : (
                "Save User"
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Tip Section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-yellow-800 text-xs font-bold">!</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-yellow-800 mb-1">
              Tip: Use Import for multiple users, Export for backups, or Bulk
              Edit to modify existing users
            </h3>
            <p className="text-sm text-yellow-700">
              Click Import to upload CSV files, Export to download user data, or
              Bulk Edit to modify multiple users at once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUser;
