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
const randomstring = require('randomstring');
const Deal = db.deals;
const DealComments = db.deal_comments;
const DealTeamMembers = db.deal_team_members;
const DealExternalAdvisors = db.deal_external_advisors;
const RecentActivity = db.recent_activities;
const { detectChanges, logUserChanges } = require('../services/changeLogService');

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
};