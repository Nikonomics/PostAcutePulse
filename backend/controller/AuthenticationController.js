const { query } = require("express");
const jwt = require("jsonwebtoken");
const jwtToken = process.env.JWT_SECRET;
const bcrypt = require("bcryptjs");
let helper = require("../config/helper");
const db = require("../models");
const sequelize = require("sequelize");
const Op = sequelize.Op;
const AWS = require('aws-sdk');
const User = db.users;
const UserNotifications = db.user_notifications;
const UserInvitations = db.user_invitations;
const randomstring = require('randomstring');
const crypto = require('crypto');
const Deal = db.deals;
const DealComments = db.deal_comments;
const DealTeamMembers = db.deal_team_members;
const DealExternalAdvisors = db.deal_external_advisors;
const RecentActivity = db.recent_activities;
const { detectChanges, logUserChanges } = require('../services/changeLogService');
const { sendInvitationEmail } = require('../config/sendMail');
const { VALID_ROLES } = require('../passport');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});


module.exports = {
  signUp: async (req, res) => {
    try {
      const required = {
        email: req.body.email,
        password: req.body.password,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
      };
      const nonrequired = {
        phone_number: req.body.phone_number,
        department: req.body.department,
      };
      const requiredData = await helper.validateObject(required, nonrequired);

      const existingUser = await User.findOne({ where: { email: requiredData.email } });
      if (existingUser) {
        return helper.error(res, "Your email is already registered with us. Please log in.");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(requiredData.password, saltRounds);

      // Create user with default role of 'analyst' and pending approval status
      const user = await User.create({
        email: requiredData.email,
        password: hashedPassword,
        first_name: requiredData.first_name,
        last_name: requiredData.last_name,
        phone_number: requiredData.phone_number || null,
        department: requiredData.department || 'General',
        role: 'analyst', // Default role for self-registered users
        status: 'active',
        approval_status: 'pending', // Requires admin approval
      });

      const userResponse = {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        approval_status: user.approval_status,
        created_at: user.created_at,
      };

      // Notify admins about new signup (create notification for all admins)
      const admins = await User.findAll({ where: { role: 'admin', status: 'active' } });
      for (const admin of admins) {
        await UserNotifications.create({
          from_id: user.id,
          to_id: admin.id,
          notification_type: 'signup',
          title: 'New User Registration',
          content: `${user.first_name} ${user.last_name} (${user.email}) has registered and is awaiting approval.`,
          ref_id: user.id,
          is_read: false,
        });
      }

      return helper.success(res, "Account created successfully! Your account is pending admin approval. You will be notified once approved.", {
        user: userResponse,
        pending_approval: true,
      });
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  Login: async (req, res) => {
    try {
      const required = {
        email: req.body.email,
        password: req.body.password,
      };
      const nonrequired = {};
      const requestedData = await helper.validateObject(required, nonrequired);

      // Find user by email
      const user = await User.findOne({
        where: {
          email: requestedData.email,
        },
      });

      if (!user) {
        return helper.error(res, "This email is not associated with us.");
      }

      // Compare password
      const passwordMatch = await bcrypt.compare(requestedData.password, user.password.replace("$2y$", "$2b$"));
      if (!passwordMatch) {
        return helper.error(res, "Password does not match.");
      }

      // Check if user account is active
      if (user.status !== 'active') {
        return helper.error(res, "Your account has been deactivated. Please contact an administrator.");
      }

      // Check approval status
      if (user.approval_status === 'pending') {
        return helper.error(res, "Your account is pending admin approval. You will be notified once approved.");
      }
      if (user.approval_status === 'rejected') {
        return helper.error(res, "Your account registration was not approved. Please contact an administrator for more information.");
      }

      // Create token
      const credentials = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      // Generate access token (short-lived) and refresh token (long-lived)
      const token = jwt.sign({ data: credentials }, jwtToken, { expiresIn: "1h" });
      const refreshToken = jwt.sign({ data: credentials, type: 'refresh' }, jwtToken, { expiresIn: "30d" });

      const userResponse = {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department: user.department,
        phone_number: user.phone_number,
        profile_url: user.profile_url,
        approval_status: user.approval_status,
        created_at: user.created_at,
      };

      return helper.success(res, "User logged in successfully", {
        token,
        refresh: refreshToken,
        user: userResponse,
      });

    } catch (err) {
      return helper.error(res, err.message || "Something went wrong");
    }
  },


  getMydetail: async (req, res) => {
    try {
      const required = {
      };
      const nonrequired = {
        user_id: req.query.user_id,
      };
      const requesteddata = await helper.validateObject(required, nonrequired);
      let whereClause = {};
      if (requesteddata.user_id) {
        whereClause = { id: requesteddata.user_id };
      } else {
        whereClause = { id: req.user.id };
      }
      let userdata = await User.findOne({ where: whereClause });
      if (!userdata) {
        return helper.error(res, "User not found");
      }
      return helper.success(res, "My details get successfully", userdata);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  createUser: async (req, res) => {
    try {
      const required = {
        first_name: req.body.first_name,
        role: req.body.role,
        last_name: req.body.last_name,
        status: req.body.status,
        email: req.body.email,
        password: req.body.password,
        phone_number: req.body.phone_number,
        password: req.body.password,
        department: req.body.department,
      };
      const nonrequired = {
        permission: req.body.permission,
        email_notifications: req.body.email_notifications,
        send_welcome_email: req.body.send_welcome_email,
      };
      const requesteddata = await helper.validateObject(required, nonrequired);

      const existingUser = await User.findOne({ where: { email: requesteddata.email } });
      if (existingUser) {
        return helper.error(res, "Your email is already registered with us. Please log in.");
      }

      const saltRounds = 10;
      await bcrypt.hash(requesteddata.password, saltRounds).then(function (hash) { requesteddata.password = hash });

      const user = await User.create(requesteddata);

      return helper.success(res, "User created successfully", user);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  getUsers: async (req, res) => {
    try {
      const nonrequired = {
        role: req.query.role,
        status: req.query.status,
        department: req.query.department,
        search: req.query.search
      };

      let whereClause = {};

      if (nonrequired.role) {
        whereClause.role = nonrequired.role;
      }
      if (nonrequired.status) {
        whereClause.status = nonrequired.status;
      }
      if (nonrequired.department) {
        whereClause.department = nonrequired.department;
      }
      if (nonrequired.search) {
        whereClause[sequelize.Op.or] = [
          { first_name: { [sequelize.Op.like]: `%${nonrequired.search}%` } },
          { last_name: { [sequelize.Op.like]: `%${nonrequired.search}%` } },
          { email: { [sequelize.Op.like]: `%${nonrequired.search}%` } }
        ];
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const users = await User.findAndCountAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [['created_at', 'DESC']],
        attributes: { exclude: ['password'] }
      });

      const totalPages = Math.ceil(users.count / limit);

      const response = {
        users: users.rows,
        pagination: {
          total: users.count,
          totalPages: totalPages,
          currentPage: page,
          limit: limit
        }
      };

      return helper.success(res, "Users fetched successfully", response);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to delete a user:
  Method: DELETE
  URL: /api/v1/user/delete-user/:id
  */
  deleteUser: async (req, res) => {
    try {
      const required = { id: req.params.id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const user = await User.findByPk(requiredData.id);
      if (!user) {
        return helper.error(res, "User not found");
      }

      // delete the user:
      await user.update({ status: "inactive" });

      // return the success response:
      return helper.success(res, "User deleted successfully", { id: user.id });
    } catch (err) {
      return helper.error(res, err);
    }
  },

  getuserStats: async (req, res) => {
    try {
      // Get total users count
      const totalUsers = await User.count();

      // Get active users count
      const activeUsers = await User.count({
        where: {
          status: 'active'
        }
      });

      // Get admin users count
      const adminUsers = await User.count({
        where: {
          role: 'admin'
        }
      });

      // Get deal manager users count
      const dealManagerUsers = await User.count({
        where: {
          role: 'deal_manager'
        }
      });

      // Get analyst users count
      const analystUsers = await User.count({
        where: {
          role: 'analyst'
        }
      });

      // Get reviewer users count
      const reviewerUsers = await User.count({
        where: {
          role: 'reviewer'
        }
      });

      const stats = {
        total_users: totalUsers,
        active_users: activeUsers,
        admin_users: adminUsers,
        deal_manager_users: dealManagerUsers,
        analyst_users: analystUsers,
        reviewer_users: reviewerUsers
      };

      return helper.success(res, "User stats fetched successfully", stats);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  this function will help to fetch all active users
  Method: GET
  URL: /api/v1/user/active-users
  */
  getactiveUsers: async (req, res) => {
    try {
      // fetch all active users:
      const activeUsers = await User.findAll({ where: { status: 'active' } });

      // return the success message:
      return helper.success(res, "Active users fetched successfully", activeUsers);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  fileUpload: async (req, res) => {
    try {
      let fileUrls = [];
      let attachment = req.files.file;

      if (!attachment) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Handle multiple file uploads
      const files = Array.isArray(attachment) ? attachment : [attachment];

      for (const file of files) {
        const fileExtension = file.name.split(".").pop();
        const randomFileName = `${randomstring.generate(15)}.${fileExtension}`;

        // Upload file to S3
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME, // Your S3 bucket name
          Key: `uploads/${randomFileName}`, // Folder inside the bucket
          Body: file.data,
          ContentType: file.mimetype,
          ACL: "public-read", // Allows public access (optional)
        };

        const uploadResult = await s3.upload(params).promise();
        fileUrls.push(uploadResult.Location); // Capture file URL from S3
      }
      return helper.success(res, "File uploaded successfully", fileUrls);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  this function will help to fetch user recent activity
  Method: GET
  URL: /api/v1/user/recent-activity
  */
  getUserRecentActivity: async (req, res) => {
    try {
      const required = {
        user_id: req.user.id,
      };
      const nonrequired = {};
      const requesteddata = await helper.validateObject(required, nonrequired);

      // fetch all user recent activity:
      const userRecentActivity = await RecentActivity.findAll({ where: { to_id: requesteddata.user_id, is_team: false }, order: [['createdAt', 'DESC']], limit: 5 });

      // return the success message
      return helper.success(res, "User recent activity fetched successfully", userRecentActivity);
    }
    catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  this function will help to fetch team recent activity
  Method: GET
  URL: /api/v1/user/team-recent-activity
  */
  getTeamRecentActivity: async (req, res) => {
    try {
      const required = {
        user_id: req.user.id,
      };
      const nonrequired = {};
      const requesteddata = await helper.validateObject(required, nonrequired);

      // fetch all user recent activity:
      const userRecentActivity = await RecentActivity.findAll({ where: { to_id: requesteddata.user_id, is_team: true }, order: [['createdAt', 'DESC']], limit: 5 });

      // return the success message
      return helper.success(res, "User recent activity fetched successfully", userRecentActivity);
    }
    catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  Approve a pending user registration
  Method: POST
  URL: /api/v1/auth/approve-user/:id
  */
  approveUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const adminId = req.user.id;

      // Verify admin role
      const admin = await User.findByPk(adminId);
      if (!admin || admin.role !== 'admin') {
        return helper.error(res, "Only administrators can approve users.");
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return helper.error(res, "User not found");
      }

      if (user.approval_status === 'approved') {
        return helper.error(res, "User is already approved");
      }

      // Update approval status
      await user.update({
        approval_status: 'approved',
        approved_by: adminId,
        approved_at: new Date(),
      });

      // Notify the user
      await UserNotifications.create({
        from_id: adminId,
        to_id: user.id,
        notification_type: 'approval',
        title: 'Account Approved',
        content: 'Your account has been approved! You can now log in to SNFalyze.',
        ref_id: user.id,
        is_read: false,
      });

      return helper.success(res, "User approved successfully", {
        id: user.id,
        email: user.email,
        approval_status: 'approved',
      });
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Reject a pending user registration
  Method: POST
  URL: /api/v1/auth/reject-user/:id
  */
  rejectUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const adminId = req.user.id;
      const { reason } = req.body;

      // Verify admin role
      const admin = await User.findByPk(adminId);
      if (!admin || admin.role !== 'admin') {
        return helper.error(res, "Only administrators can reject users.");
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return helper.error(res, "User not found");
      }

      // Update approval status
      await user.update({
        approval_status: 'rejected',
        approved_by: adminId,
        approved_at: new Date(),
      });

      // Notify the user
      await UserNotifications.create({
        from_id: adminId,
        to_id: user.id,
        notification_type: 'rejection',
        title: 'Account Not Approved',
        content: reason || 'Your account registration was not approved. Please contact an administrator for more information.',
        ref_id: user.id,
        is_read: false,
      });

      return helper.success(res, "User rejected", {
        id: user.id,
        email: user.email,
        approval_status: 'rejected',
      });
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Get pending users awaiting approval
  Method: GET
  URL: /api/v1/auth/pending-users
  */
  getPendingUsers: async (req, res) => {
    try {
      const adminId = req.user.id;

      // Verify admin role
      const admin = await User.findByPk(adminId);
      if (!admin || admin.role !== 'admin') {
        return helper.error(res, "Only administrators can view pending users.");
      }

      const pendingUsers = await User.findAll({
        where: { approval_status: 'pending' },
        attributes: { exclude: ['password'] },
        order: [['created_at', 'DESC']],
      });

      return helper.success(res, "Pending users fetched successfully", pendingUsers);
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Update user profile (self-service)
  Method: PUT
  URL: /api/v1/auth/update-profile
  */
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { first_name, last_name, phone_number, department, profile_url } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return helper.error(res, "User not found");
      }

      // Capture old values for change logging
      const oldData = {
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        department: user.department,
        profile_url: user.profile_url
      };

      // Update allowed fields only
      const updateData = {};
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;
      if (phone_number !== undefined) updateData.phone_number = phone_number;
      if (department !== undefined) updateData.department = department;
      if (profile_url !== undefined) updateData.profile_url = profile_url;
      updateData.updated_at = new Date();

      await user.update(updateData);

      // Log changes
      const changes = detectChanges(oldData, updateData, ['first_name', 'last_name', 'phone_number', 'department', 'profile_url']);
      if (changes.length > 0) {
        await logUserChanges(userId, userId, 'profile_updated', changes);
      }

      const userResponse = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        department: user.department,
        profile_url: user.profile_url,
        role: user.role,
        updated_at: user.updated_at,
      };

      return helper.success(res, "Profile updated successfully", userResponse);
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Change password (self-service)
  Method: PUT
  URL: /api/v1/auth/change-password
  */
  changePassword: async (req, res) => {
    try {
      const userId = req.user.id;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return helper.error(res, "Current password and new password are required");
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return helper.error(res, "User not found");
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(current_password, user.password.replace("$2y$", "$2b$"));
      if (!passwordMatch) {
        return helper.error(res, "Current password is incorrect");
      }

      // Hash new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(new_password, saltRounds);

      await user.update({
        password: hashedPassword,
        updated_at: new Date(),
      });

      // Log password change (don't log actual password values)
      await logUserChanges(userId, userId, 'password_changed', [{
        field_name: 'password',
        field_label: 'Password',
        old_value: '********',
        new_value: '********'
      }]);

      return helper.success(res, "Password changed successfully");
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Get user notifications
  Method: GET
  URL: /api/v1/auth/notifications
  */
  getNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const { unread_only, limit = 20 } = req.query;

      let whereClause = { to_id: userId };
      if (unread_only === 'true') {
        whereClause.is_read = false;
      }

      const notifications = await UserNotifications.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        include: [{
          model: User,
          as: 'fromUser',
          attributes: ['id', 'first_name', 'last_name', 'profile_url'],
          required: false,
        }],
      });

      // Get unread count
      const unreadCount = await UserNotifications.count({
        where: { to_id: userId, is_read: false },
      });

      return helper.success(res, "Notifications fetched successfully", {
        notifications,
        unread_count: unreadCount,
      });
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Mark notification(s) as read
  Method: PUT
  URL: /api/v1/auth/notifications/read
  */
  markNotificationsRead: async (req, res) => {
    try {
      const userId = req.user.id;
      const { notification_ids, mark_all } = req.body;

      if (mark_all) {
        await UserNotifications.update(
          { is_read: true },
          { where: { to_id: userId, is_read: false } }
        );
        return helper.success(res, "All notifications marked as read");
      }

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return helper.error(res, "notification_ids array is required");
      }

      await UserNotifications.update(
        { is_read: true },
        { where: { id: notification_ids, to_id: userId } }
      );

      return helper.success(res, "Notifications marked as read");
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Get notification count (unread)
  Method: GET
  URL: /api/v1/auth/notifications/count
  */
  getNotificationCount: async (req, res) => {
    try {
      const userId = req.user.id;

      const unreadCount = await UserNotifications.count({
        where: { to_id: userId, is_read: false },
      });

      return helper.success(res, "Notification count fetched", { unread_count: unreadCount });
    } catch (err) {
      return helper.error(res, err.message || err);
    }
  },

  /*
  Generate new access token from refresh token
  Method: GET
  URL: /api/v1/auth/generate-access-token
  */
  generateAccessToken: async (req, res) => {
    try {
      // Set cache-control headers to prevent caching of token refresh responses
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return helper.error(res, "Refresh token is required", 401);
      }

      const refreshToken = authHeader.split(' ')[1];

      // Verify the refresh token
      jwt.verify(refreshToken, jwtToken, (err, decoded) => {
        if (err) {
          console.error('Token verification failed:', err.message);
          return helper.error(res, "Invalid or expired refresh token", 401);
        }

        // Check if it's NOT a refresh token (i.e., it's an access token being used incorrectly)
        if (decoded.type !== 'refresh') {
          return helper.error(res, "Invalid token type - access token cannot be used to refresh", 401);
        }

        // Generate new access token
        const credentials = {
          id: decoded.data.id,
          email: decoded.data.email,
          role: decoded.data.role,
        };

        const newAccessToken = jwt.sign({ data: credentials }, jwtToken, { expiresIn: "1h" });

        return helper.success(res, "Access token refreshed successfully", {
          token: newAccessToken,
          accessToken: newAccessToken,
          access_token: newAccessToken,
        });
      });
    } catch (err) {
      console.error('Generate access token error:', err);
      return helper.error(res, err.message || "Failed to refresh token", 401);
    }
  },

  /*
  Send invitation to a new user
  Method: POST
  URL: /api/v1/auth/invite
  Body: { email, role }
  */
  sendInvitation: async (req, res) => {
    try {
      const adminId = req.user.id;
      const { email, role } = req.body;

      // Validate inputs
      if (!email || !role) {
        return helper.error(res, "Email and role are required");
      }

      // Validate role
      if (!VALID_ROLES.includes(role)) {
        return helper.error(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return helper.error(res, "Invalid email format");
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return helper.error(res, "This email is already registered");
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await UserInvitations.findOne({
        where: { email, status: 'pending' }
      });
      if (existingInvitation) {
        return helper.error(res, "An invitation is already pending for this email. Use resend if needed.");
      }

      // Get inviter details
      const inviter = await User.findByPk(adminId);

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');

      // Create invitation (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await UserInvitations.create({
        email,
        role,
        invited_by: adminId,
        token,
        status: 'pending',
        expires_at: expiresAt
      });

      // Send invitation email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const inviteLink = `${frontendUrl}/accept-invite?token=${token}`;

      const emailResult = await sendInvitationEmail({
        invitee_email: email,
        inviter_name: `${inviter.first_name} ${inviter.last_name}`,
        role,
        invite_link: inviteLink
      });

      if (emailResult.STATUS_CODE !== 200) {
        console.error('Failed to send invitation email:', emailResult);
        // Don't fail the invitation creation, just warn
      }

      return helper.success(res, "Invitation sent successfully", {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        email_sent: emailResult.STATUS_CODE === 200
      });
    } catch (err) {
      console.error('Send invitation error:', err);
      return helper.error(res, err.message || "Failed to send invitation");
    }
  },

  /*
  Validate invitation token (public endpoint)
  Method: GET
  URL: /api/v1/auth/invite/:token
  */
  validateInvitation: async (req, res) => {
    try {
      const { token } = req.params;

      const invitation = await UserInvitations.findOne({
        where: { token, status: 'pending' }
      });

      if (!invitation) {
        return helper.error(res, "Invalid or expired invitation", 404);
      }

      // Check if expired
      if (new Date() > new Date(invitation.expires_at)) {
        await invitation.update({ status: 'expired' });
        return helper.error(res, "This invitation has expired", 410);
      }

      // Get inviter name
      const inviter = await User.findByPk(invitation.invited_by, {
        attributes: ['first_name', 'last_name']
      });

      return helper.success(res, "Valid invitation", {
        email: invitation.email,
        role: invitation.role,
        invited_by: inviter ? `${inviter.first_name} ${inviter.last_name}` : 'Unknown',
        expires_at: invitation.expires_at
      });
    } catch (err) {
      return helper.error(res, err.message || "Failed to validate invitation");
    }
  },

  /*
  Accept invitation and create account
  Method: POST
  URL: /api/v1/auth/accept-invite
  Body: { token, first_name, last_name, password }
  */
  acceptInvitation: async (req, res) => {
    try {
      const { token, first_name, last_name, password } = req.body;

      // Validate inputs
      if (!token || !first_name || !last_name || !password) {
        return helper.error(res, "Token, first name, last name, and password are required");
      }

      if (password.length < 8) {
        return helper.error(res, "Password must be at least 8 characters");
      }

      // Find invitation
      const invitation = await UserInvitations.findOne({
        where: { token, status: 'pending' }
      });

      if (!invitation) {
        return helper.error(res, "Invalid or expired invitation", 404);
      }

      // Check if expired
      if (new Date() > new Date(invitation.expires_at)) {
        await invitation.update({ status: 'expired' });
        return helper.error(res, "This invitation has expired", 410);
      }

      // Check if email already registered (race condition check)
      const existingUser = await User.findOne({ where: { email: invitation.email } });
      if (existingUser) {
        await invitation.update({ status: 'accepted' });
        return helper.error(res, "This email is already registered");
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user with pre-approved status
      const user = await User.create({
        email: invitation.email,
        password: hashedPassword,
        first_name,
        last_name,
        role: invitation.role,
        status: 'active',
        approval_status: 'approved', // Pre-approved since invited
        approved_by: invitation.invited_by,
        approved_at: new Date()
      });

      // Mark invitation as accepted
      await invitation.update({
        status: 'accepted',
        accepted_at: new Date()
      });

      // Create notification for inviter
      await UserNotifications.create({
        from_id: user.id,
        to_id: invitation.invited_by,
        notification_type: 'invitation_accepted',
        title: 'Invitation Accepted',
        content: `${first_name} ${last_name} (${invitation.email}) has accepted your invitation and joined as ${invitation.role}.`,
        ref_id: user.id,
        is_read: false
      });

      // Generate tokens for auto-login
      const credentials = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = jwt.sign({ data: credentials }, jwtToken, { expiresIn: "1h" });
      const refreshToken = jwt.sign({ data: credentials, type: 'refresh' }, jwtToken, { expiresIn: "30d" });

      return helper.success(res, "Account created successfully", {
        token: accessToken,
        refresh: refreshToken,
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      console.error('Accept invitation error:', err);
      return helper.error(res, err.message || "Failed to create account");
    }
  },

  /*
  Get all invitations (admin only)
  Method: GET
  URL: /api/v1/auth/invitations
  Query: { status } - optional filter
  */
  getInvitations: async (req, res) => {
    try {
      const { status } = req.query;

      let whereClause = {};
      if (status) {
        whereClause.status = status;
      }

      const invitations = await UserInvitations.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        include: [{
          model: User,
          as: 'inviter',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          required: false
        }]
      });

      // Format response
      const formattedInvitations = invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        invited_by: inv.inviter ? `${inv.inviter.first_name} ${inv.inviter.last_name}` : 'Unknown',
        invited_by_email: inv.inviter?.email,
        expires_at: inv.expires_at,
        accepted_at: inv.accepted_at,
        created_at: inv.created_at,
        is_expired: new Date() > new Date(inv.expires_at)
      }));

      return helper.success(res, "Invitations fetched successfully", formattedInvitations);
    } catch (err) {
      return helper.error(res, err.message || "Failed to fetch invitations");
    }
  },

  /*
  Cancel an invitation
  Method: DELETE
  URL: /api/v1/auth/invite/:id
  */
  cancelInvitation: async (req, res) => {
    try {
      const { id } = req.params;

      const invitation = await UserInvitations.findByPk(id);
      if (!invitation) {
        return helper.error(res, "Invitation not found", 404);
      }

      if (invitation.status !== 'pending') {
        return helper.error(res, "Can only cancel pending invitations");
      }

      await invitation.update({ status: 'cancelled' });

      return helper.success(res, "Invitation cancelled successfully");
    } catch (err) {
      return helper.error(res, err.message || "Failed to cancel invitation");
    }
  },

  /*
  Resend invitation email
  Method: POST
  URL: /api/v1/auth/invite/:id/resend
  */
  resendInvitation: async (req, res) => {
    try {
      const adminId = req.user.id;
      const { id } = req.params;

      const invitation = await UserInvitations.findByPk(id);
      if (!invitation) {
        return helper.error(res, "Invitation not found", 404);
      }

      if (invitation.status !== 'pending') {
        return helper.error(res, "Can only resend pending invitations");
      }

      // Generate new token and extend expiration
      const newToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await invitation.update({
        token: newToken,
        expires_at: expiresAt
      });

      // Get inviter details
      const inviter = await User.findByPk(adminId);

      // Send invitation email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const inviteLink = `${frontendUrl}/accept-invite?token=${newToken}`;

      const emailResult = await sendInvitationEmail({
        invitee_email: invitation.email,
        inviter_name: `${inviter.first_name} ${inviter.last_name}`,
        role: invitation.role,
        invite_link: inviteLink
      });

      return helper.success(res, "Invitation resent successfully", {
        id: invitation.id,
        email: invitation.email,
        expires_at: expiresAt,
        email_sent: emailResult.STATUS_CODE === 200
      });
    } catch (err) {
      return helper.error(res, err.message || "Failed to resend invitation");
    }
  },

  /*
  Get available roles for invitation dropdown
  Method: GET
  URL: /api/v1/auth/roles
  */
  getRoles: async (req, res) => {
    try {
      const roleDescriptions = {
        'admin': 'Full platform access including user management',
        'deal_manager': 'Create and manage M&A deals',
        'analyst': 'Work on assigned deals and run analyses',
        'viewer': 'View-only access to assigned deals'
      };

      const roles = VALID_ROLES.map(role => ({
        value: role,
        label: role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: roleDescriptions[role]
      }));

      return helper.success(res, "Roles fetched successfully", roles);
    } catch (err) {
      return helper.error(res, err.message || "Failed to fetch roles");
    }
  },

  /*
  Update user (admin only)
  Method: PUT
  URL: /api/v1/auth/update-user
  Body: { id, first_name, last_name, phone_number, department, role, status, permission, password }
  */
  updateUser: async (req, res) => {
    try {
      const { id, first_name, last_name, phone_number, department, role, status, permission, password } = req.body;
      const adminId = req.user.id;

      if (!id) {
        return helper.error(res, "User ID is required");
      }

      const user = await User.findByPk(id);
      if (!user) {
        return helper.error(res, "User not found", 404);
      }

      // Build update object with only provided fields
      const updateData = {};
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;
      if (phone_number !== undefined) updateData.phone_number = phone_number;
      if (department !== undefined) updateData.department = department;
      if (status !== undefined) updateData.status = status;
      if (permission !== undefined) updateData.permission = permission;

      // Validate and set role if provided
      if (role !== undefined) {
        if (!VALID_ROLES.includes(role)) {
          return helper.error(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
        }
        updateData.role = role;
      }

      // Hash password if provided
      if (password && password.length >= 8) {
        const saltRounds = 10;
        updateData.password = await bcrypt.hash(password, saltRounds);
      } else if (password && password.length > 0 && password.length < 8) {
        return helper.error(res, "Password must be at least 8 characters");
      }

      updateData.updated_at = new Date();

      await user.update(updateData);

      return helper.success(res, "User updated successfully", {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status
      });
    } catch (err) {
      console.error('Update user error:', err);
      return helper.error(res, err.message || "Failed to update user");
    }
  },

  /*
  Update user role (admin only)
  Method: PUT
  URL: /api/v1/auth/user/:id/role
  Body: { role }
  */
  updateUserRole: async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const adminId = req.user.id;

      if (!role) {
        return helper.error(res, "Role is required");
      }

      if (!VALID_ROLES.includes(role)) {
        return helper.error(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
      }

      const user = await User.findByPk(id);
      if (!user) {
        return helper.error(res, "User not found", 404);
      }

      // Prevent changing own role
      if (parseInt(id) === adminId) {
        return helper.error(res, "Cannot change your own role");
      }

      const oldRole = user.role;
      await user.update({ role, updated_at: new Date() });

      // Log the change
      await logUserChanges(adminId, id, 'role_updated', [{
        field_name: 'role',
        field_label: 'Role',
        old_value: oldRole,
        new_value: role
      }]);

      // Notify user
      await UserNotifications.create({
        from_id: adminId,
        to_id: user.id,
        notification_type: 'role_changed',
        title: 'Role Updated',
        content: `Your role has been changed from ${oldRole} to ${role}.`,
        ref_id: user.id,
        is_read: false
      });

      return helper.success(res, "User role updated successfully", {
        id: user.id,
        email: user.email,
        role: user.role
      });
    } catch (err) {
      return helper.error(res, err.message || "Failed to update user role");
    }
  },
};