import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Users,
  UserPlus,
  Shield,
  HardDrive,
  Clock,
  Download,
  Upload,
  FileText,
  Settings,
  Activity,
  AlertTriangle,
  Edit3,
  Trash2,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUsers, getUserStats, deleteUser } from "../api/userService";
import { getRecentActivity } from "../api/DealService";
import { getPendingUsers, approveUser, rejectUser, getInvitations, cancelInvitation, resendInvitation } from "../api/authService";
import { toast } from "react-toastify";
import { Modal, Button, Badge } from "react-bootstrap";
import InviteUserModal from "../components/InviteUserModal";


const StatusBadge = ({ status }) => {
  const statusConfig = {
    Active: { color: "bg-green-100 text-green-800", dot: "bg-green-400" },
    Away: { color: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-400" },
    Inactive: { color: "bg-red-100 text-red-800", dot: "bg-red-400" },
  };

  const config = statusConfig[status] || {
    color: "bg-gray-100 text-gray-800",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {status}
    </span>
  );
};

const RoleBadge = ({ role }) => {
  const roleConfig = {
    Admin: { color: "bg-red-100 text-red-800" },
    "Deal Manager": { color: "bg-blue-100 text-blue-800" },
    Analyst: { color: "bg-green-100 text-green-800" },
    Reviewer: { color: "bg-gray-100 text-gray-800" },
  };

  const config = roleConfig[role] || { color: "bg-gray-100 text-gray-800" };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${config.color}`}
    >
      {role}
    </span>
  );
};

const UserAvatar = ({ name, color = "bg-blue-500" }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white text-sm font-medium`}
    >
      {initials}
    </div>
  );
};

const UserManagement = () => {
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [lastActiveFilter, setLastActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(3);
  const [users, setUsers] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pending users approval state
  const [activeTab, setActiveTab] = useState("users"); // "users", "pending", or "invitations"
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(null);

  // Invitation state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationActionLoading, setInvitationActionLoading] = useState(null);

  const roleStats = [
    {
      role: "Admin",
      description: "Full System Access",
      permissions: "User and Settings",
      count: userStats.admin_users,
      color: "bg-red-500",
    },
    {
      role: "Deal Manager",
      description: "Deal Management",
      permissions: "Team management",
      count: userStats.deal_manager_users,
      color: "bg-blue-500",
    },
    {
      role: "Analyst",
      description: "Analysis Specialist",
      permissions: "Report generation",
      count: userStats.analyst_users,
      color: "bg-green-500",
    },
    {
      role: "Reviewer",
      description: "Read-only access",
      permissions: "Review permissions",
      count: userStats.reviewer_users,
      color: "bg-gray-500",
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, recentActivityData] = await Promise.all([
        getUsers(
          currentPage,
          pageSize,
          searchTerm,
          "name",
          roleFilter,
          statusFilter,
          departmentFilter
        ),
        getRecentActivity()
      ]);
      const statsData = await getUserStats();
      setUsers(usersData.body);
      setTotalPages(usersData?.body?.pagination.totalPages);
      setTotalItems(usersData?.body?.pagination.total);
      setUserStats(statsData.body);
      setRecentActivity(recentActivityData.body);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const handleShowUserModal = (id) => {
    setShowUserModal(true);
    setDeleteLoadingId(id);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setDeleteLoadingId(null);
  };

  // Fetch pending users
  const fetchPendingUsers = async () => {
    setPendingLoading(true);
    try {
      const response = await getPendingUsers();
      // Handle both response.body (array) and response.body.users patterns
      const users = Array.isArray(response.body) ? response.body :
                    Array.isArray(response.body?.users) ? response.body.users : [];
      setPendingUsers(users);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      setPendingUsers([]); // Reset to empty array on error
    } finally {
      setPendingLoading(false);
    }
  };

  // Handle approve user
  const handleApproveUser = async (userId) => {
    setApprovalLoading(userId);
    try {
      const response = await approveUser(userId);
      if (response.success) {
        toast.success(response.message || "User approved successfully");
        fetchPendingUsers();
        fetchData(); // Refresh main user list
      } else {
        toast.error(response.message || "Failed to approve user");
      }
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user");
    } finally {
      setApprovalLoading(null);
    }
  };

  // Handle reject user
  const handleRejectUser = async (userId) => {
    setApprovalLoading(userId);
    try {
      const response = await rejectUser(userId);
      if (response.success) {
        toast.success(response.message || "User rejected");
        fetchPendingUsers();
      } else {
        toast.error(response.message || "Failed to reject user");
      }
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast.error("Failed to reject user");
    } finally {
      setApprovalLoading(null);
    }
  };

  // Fetch invitations
  const fetchInvitations = async () => {
    setInvitationsLoading(true);
    try {
      const response = await getInvitations();
      if (response.success) {
        setInvitations(response.body || []);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  };

  // Handle cancel invitation
  const handleCancelInvitation = async (invitationId) => {
    setInvitationActionLoading(invitationId);
    try {
      const response = await cancelInvitation(invitationId);
      if (response.success) {
        toast.success("Invitation cancelled");
        fetchInvitations();
      } else {
        toast.error(response.message || "Failed to cancel invitation");
      }
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast.error("Failed to cancel invitation");
    } finally {
      setInvitationActionLoading(null);
    }
  };

  // Handle resend invitation
  const handleResendInvitation = async (invitationId) => {
    setInvitationActionLoading(invitationId);
    try {
      const response = await resendInvitation(invitationId);
      if (response.success) {
        toast.success("Invitation resent");
        fetchInvitations();
      } else {
        toast.error(response.message || "Failed to resend invitation");
      }
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast.error("Failed to resend invitation");
    } finally {
      setInvitationActionLoading(null);
    }
  };

  // handle delete deal
  const handleDeleteUser = async (id) => {
    setDeleteLoading(true);
    try {
      const response = await deleteUser(deleteLoadingId);

      if (response.success !== true) {
        toast.error(response.message);
        return
      }

      toast.success(response.message);
      fetchData();
    } catch (error) {
      console.error("Failed to delete user", error);
      toast.error(error.message);
    } finally {
      setDeleteLoading(false);
      setShowUserModal(false);
    }
  };

  // Fix: fetch paginated users from API, not all and then slice
  useEffect(() => {
    fetchData();
    fetchPendingUsers(); // Also fetch pending users on load
    fetchInvitations(); // Also fetch invitations on load
  }, [
    currentPage,
    pageSize,
    searchTerm,
    roleFilter,
    statusFilter,
    departmentFilter,
  ]);

  // Use total from API if available, fallback to users.users.length
  const totalUsers = totalItems;
  const paginatedUsers = users?.users || [];

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    if (page !== currentPage) {
      setCurrentPage(page);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map((user) => user.id));
    }
  };

  const clearFilters = () => {
    setRoleFilter("All");
    setStatusFilter("All");
    setDepartmentFilter("All");
    setLastActiveFilter("All");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Pagination controls
  const renderPagination = () => {
    let pages = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages = [1, 2, 3, 4, "dots", totalPages];
      } else if (currentPage >= totalPages - 2) {
        pages = [
          1,
          "dots",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      } else {
        pages = [
          1,
          "dots",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "dots",
          totalPages,
        ];
      }
    }

    return (
      <div className="flex items-center gap-2 mt-3 mt-lg-0 justify-content-end">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((page, idx) =>
          page === "dots" ? (
            <span key={`dots-${idx}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={`page-${page}`}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1 rounded text-sm border ${currentPage === page
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
                }`}
              disabled={currentPage === page}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  return (
    <>
      {loading ? (
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ height: "80vh" }}
        >
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          ></span>
        </div>
      ) : (
        <>
          <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-4">
              <div className="row">
                <div className="col-md-5">
                  <h1 className="text-3xl font-bold text-gray-900">
                    User Management
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Manage user accounts, roles, and permissions
                  </p>
                </div>
                <div className="col-lg-7">
                  <div className="d-flex flex-wrap gap-3 justify-content-lg-end">
                    {/* <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Upload size={16} />
                      Import
                    </button> */}
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Download size={16} />
                      Export
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 border-0"
                      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      onClick={() => setShowInviteModal(true)}
                    >
                      <Mail size={16} />
                      Invite User
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 border-0"
                      onClick={() => navigate("/create-user")}
                    >
                      <Plus size={16} />
                      Add User
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Buttons */}
            <div className="mb-4">
              <div className="d-flex gap-2">
                <button
                  className={`px-4 py-2 rounded-lg font-medium ${
                    activeTab === "users"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setActiveTab("users")}
                >
                  All Users
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-medium d-flex align-items-center gap-2 ${
                    activeTab === "pending"
                      ? "bg-orange-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setActiveTab("pending")}
                  style={activeTab === "pending" ? { backgroundColor: "#ea580c" } : {}}
                >
                  Pending Approvals
                  {pendingUsers.length > 0 && (
                    <Badge bg="danger" pill style={{ fontSize: "0.75rem" }}>
                      {pendingUsers.length}
                    </Badge>
                  )}
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-medium d-flex align-items-center gap-2 ${
                    activeTab === "invitations"
                      ? "text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setActiveTab("invitations")}
                  style={activeTab === "invitations" ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}}
                >
                  Invitations
                  {invitations.filter(i => i.status === 'pending').length > 0 && (
                    <Badge bg="primary" pill style={{ fontSize: "0.75rem" }}>
                      {invitations.filter(i => i.status === 'pending').length}
                    </Badge>
                  )}
                </button>
              </div>
            </div>

            {/* Pending Users Section */}
            {activeTab === "pending" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6 p-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 px-3">
                  Users Awaiting Approval
                </h3>
                {pendingLoading ? (
                  <div className="text-center py-5">
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span className="ms-2">Loading...</span>
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <div className="text-center py-5 text-gray-500">
                    No pending users to approve
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Requested
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <UserAvatar name={user.first_name || user.email} />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.first_name} {user.last_name}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="d-flex gap-2">
                                <button
                                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 border-0"
                                  onClick={() => handleApproveUser(user.id)}
                                  disabled={approvalLoading === user.id}
                                >
                                  {approvalLoading === user.id ? (
                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                  ) : (
                                    "Approve"
                                  )}
                                </button>
                                <button
                                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 border-0"
                                  onClick={() => handleRejectUser(user.id)}
                                  disabled={approvalLoading === user.id}
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Invitations Section */}
            {activeTab === "invitations" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6 p-3">
                <div className="d-flex justify-content-between align-items-center mb-4 px-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-0">
                    User Invitations
                  </h3>
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 border-0"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    onClick={() => setShowInviteModal(true)}
                  >
                    <Mail size={16} />
                    Send New Invitation
                  </button>
                </div>
                {invitationsLoading ? (
                  <div className="text-center py-5">
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span className="ms-2">Loading...</span>
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="text-center py-5 text-gray-500">
                    <Mail size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No invitations sent yet</p>
                    <button
                      className="mt-2 px-4 py-2 text-white rounded-lg border-0"
                      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      onClick={() => setShowInviteModal(true)}
                    >
                      Send Your First Invitation
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Invited By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sent
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invitations.map((invitation) => (
                          <tr key={invitation.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {invitation.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <RoleBadge role={invitation.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {invitation.status === 'pending' && !invitation.is_expired && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Pending
                                </span>
                              )}
                              {invitation.status === 'pending' && invitation.is_expired && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Expired
                                </span>
                              )}
                              {invitation.status === 'accepted' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Accepted
                                </span>
                              )}
                              {invitation.status === 'cancelled' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Cancelled
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invitation.invited_by}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invitation.created_at ? new Date(invitation.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {invitation.status === 'pending' && (
                                <div className="d-flex gap-2">
                                  <button
                                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 border-0 d-flex align-items-center gap-1"
                                    onClick={() => handleResendInvitation(invitation.id)}
                                    disabled={invitationActionLoading === invitation.id}
                                    title="Resend invitation"
                                  >
                                    {invitationActionLoading === invitation.id ? (
                                      <span className="spinner-border spinner-border-sm" role="status"></span>
                                    ) : (
                                      <>
                                        <RefreshCw size={14} />
                                        Resend
                                      </>
                                    )}
                                  </button>
                                  <button
                                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 border-0 d-flex align-items-center gap-1"
                                    onClick={() => handleCancelInvitation(invitation.id)}
                                    disabled={invitationActionLoading === invitation.id}
                                    title="Cancel invitation"
                                  >
                                    <XCircle size={14} />
                                    Cancel
                                  </button>
                                </div>
                              )}
                              {invitation.status !== 'pending' && (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Stats Cards - Only show on users tab */}
            {activeTab === "users" && (
            <div className="row mb-4">
              <div className="col-sm-6 col-lg-4 mb-3 mb-lg-0">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {userStats.total_users || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Total Users
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-sm-6 col-lg-4 mb-3 mb-lg-0 ">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {userStats.active_users || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Active Users
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-sm-12 col-lg-4 mb-3 mb-lg-0 ">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {userStats.admin_users || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Admin Users
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Filters - Only show on users tab */}
            {activeTab === "users" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="row  align-items-baseline align-items-lg-center">
                {/* Search */}
                <div className="col-lg-4">
                  <div className="position-relative">
                    <Search className="search-user-icon" size={20} />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="search-user w-full form-input"
                    />
                  </div>
                </div>
                <div className="col-lg-8 mt-3 mt-lg-0">
                  <div className="d-flex gap-3 flex-wrap justify-content-end">
                    <select
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">Role: All</option>
                      <option value="Admin">Admin</option>
                      <option value="Deal_Manager">Deal Manager</option>
                      <option value="Analyst">Analyst</option>
                      <option value="Reviewer">Reviewer</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">Status: All</option>
                      <option value="Active">Active</option>
                      <option value="Away">Away</option>
                      <option value="Inactive">Inactive</option>
                    </select>

                    <select
                      value={departmentFilter}
                      onChange={(e) => {
                        setDepartmentFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">Department: All</option>
                      <option value="M&A Team">M&A Team</option>
                      <option value="Finance">Finance</option>
                      <option value="Legal">Legal</option>
                      <option value="Operations">Operations</option>
                    </select>

                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300"
                    >
                      Clear
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 border-0">
                      Bulk Select
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Users Table - Only show on users tab */}
            {activeTab === "users" && (
            <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6 p-3 ">
              <div className="table-responsive user-table">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectedUsers.length === paginatedUsers.length &&
                            paginatedUsers.length > 0
                          }
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        style={{ width: "100px;" }}
                      >
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-4 text-center">
                          Loading...
                        </td>
                      </tr>
                    ) : paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-4 text-center">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.id)}
                              onChange={() => handleSelectUser(user.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-start gap-2">
                              <UserAvatar
                                name={user.first_name}
                                color={user.avatar}
                              />
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {user.role}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.department}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap ">
                            <StatusBadge status={user.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button className="action-btn edit">
                              <Edit3
                                size={16}
                                onClick={() => navigate(`/edit-user/${user.id}`)}
                              />
                            </button>
                            {user.status === "active" && user.id !== JSON.parse(localStorage.getItem("authUser"))?.id && <button className="action-btn delete">
                                <Trash2
                                  size={16}
                                  onClick={() => handleShowUserModal(user.id)}
                              />
                            </button>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-white px-6 p-3 d-sm-flex gap-4 items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  {totalUsers === 0
                    ? "No users to display"
                    : `Showing ${(currentPage - 1) * pageSize + 1
                    } to ${Math.min(
                      currentPage * pageSize,
                      totalUsers
                    )} of ${totalUsers} users`}
                </div>
                {renderPagination()}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="row">
              <div className="col-lg-7">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Role Management
                  </h3>
                  <div className="row">
                    {roleStats.map((role, index) => (
                      <div className="col-md-6 mb-3" key={index}>
                        <div
                          className={`${role.color} text-white rounded-lg text-center py-2`}
                        >
                          <div className="text-sm font-medium">{role.role}</div>
                          <div className="text-xs opacity-90 mb-2">
                            {role.description}
                          </div>
                          <div className="text-xs opacity-75">
                            {role.permissions}
                          </div>
                          <div className="text-2xl font-bold mt-2">
                            {role.count}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-lg-5 mt-3 mt-lg-0">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent System Activity
                  </h3>
                  <div className="space-y-2 mainrecent">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 text-sm text-gray-700 border-bottom pb-3 recent-border"
                      >
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <span
                          className="text-gray-900 "
                          style={{ width: "70%" }}
                        >
                          {activity.message}
                        </span>
                        <span className="text-gray-400 text-xs ms-auto">
                          {activity.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}

          </div>

          {/* Delete User Modal */}
          <Modal show={showUserModal} onHide={handleCloseUserModal} centered>
            <Modal.Header closeButton>
              <Modal.Title>Confirm Deletion</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              Are you sure you want to delete this user? This action cannot be undone.
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseUserModal}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteUser} disabled={deleteLoading}>
                {deleteLoading ? <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span> : "Delete"}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Invite User Modal */}
          <InviteUserModal
            show={showInviteModal}
            onHide={() => setShowInviteModal(false)}
            onInviteSent={fetchInvitations}
          />
        </>
      )}
    </>
  );
};

export default UserManagement;
