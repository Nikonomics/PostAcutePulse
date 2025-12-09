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

      // Create user with default role of 'analyst' and active status
      const user = await User.create({
        email: requiredData.email,
        password: hashedPassword,
        first_name: requiredData.first_name,
        last_name: requiredData.last_name,
        phone_number: requiredData.phone_number || null,
        department: requiredData.department || 'General',
        role: 'analyst', // Default role for self-registered users
        status: 'active',
      });

      const credential = { id: user.id, email: user.email, role: user.role };
      const token = jwt.sign({ data: credential }, jwtToken, { expiresIn: "7d" });

      const userResponse = {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      };

      return helper.success(res, "Account created successfully! Welcome to SNFalyze.", {
        token: token,
        user: userResponse,
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

      // Create token
      const credentials = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign({ data: credentials }, jwtToken, { expiresIn: "7d" });

      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      };

      return helper.success(res, "User logged in successfully", {
        token,
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
};