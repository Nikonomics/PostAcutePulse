var express = require('express');
const bcrypt = require('bcryptjs');
const requireAuthentication = require("../passport").authenticateUser;
const db = require('../models');
const User = db.users;
var router = express.Router();

// GET /api/users - Get current user
router.get('/', requireAuthentication, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      body: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id || 1,
        is_verified: user.is_verified,
        created_at: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

// POST /api/users - Create user (signup)
router.post('/', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      full_name,
      email,
      password: hashedPassword,
      is_verified: true, // For development
      role_id: 1,
    });

    res.json({
      success: true,
      message: 'User created successfully',
      body: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// PUT /api/users - Update user (also handles password reset)
router.put('/', requireAuthentication, async (req, res) => {
  try {
    const { password, full_name } = req.body;
    const updates = {};

    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }
    if (full_name) {
      updates.full_name = full_name;
    }

    await User.update(updates, { where: { id: req.user.id } });

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// GET /api/users/team-members - List team members
router.get('/team-members', requireAuthentication, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'full_name', 'email', 'role_id', 'is_active', 'createdAt']
    });

    res.json({
      success: true,
      body: {
        team_members: users.map(u => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role_id: u.role_id,
          status: u.is_active ? 'active' : 'inactive',
          created_at: u.createdAt,
        })),
        total: users.length
      }
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ success: false, message: 'Failed to get team members' });
  }
});

// POST /api/users/team-members - Add team member
router.post('/team-members', requireAuthentication, async (req, res) => {
  try {
    const { full_name, email, password, role_id } = req.body;

    const hashedPassword = await bcrypt.hash(password || 'temppass123', 10);

    const user = await User.create({
      full_name,
      email,
      password: hashedPassword,
      role_id: role_id || 1,
      is_verified: true,
    });

    res.json({
      success: true,
      message: 'Team member added successfully',
      body: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ success: false, message: 'Failed to add team member' });
  }
});

// GET /api/users/roles - List roles
router.get('/roles', requireAuthentication, async (req, res) => {
  try {
    const roles = [
      { id: 1, name: 'Super Admin', description: 'Full system access' },
      { id: 2, name: 'Regional Director', description: 'Regional oversight' },
      { id: 3, name: 'Facility Admin', description: 'Facility management' },
      { id: 4, name: 'Department Head', description: 'Department access' },
      { id: 5, name: 'Legal Counsel', description: 'Legal review access' },
      { id: 6, name: 'Executive', description: 'Executive view' },
    ];

    res.json({
      success: true,
      body: { roles }
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: 'Failed to get roles' });
  }
});

// GET /api/users/departments - List departments
router.get('/departments', requireAuthentication, async (req, res) => {
  try {
    const departments = [
      { id: 1, name: 'Operations', description: 'Operations department' },
      { id: 2, name: 'Finance', description: 'Finance department' },
      { id: 3, name: 'Legal', description: 'Legal department' },
      { id: 4, name: 'HR', description: 'Human Resources' },
      { id: 5, name: 'Clinical', description: 'Clinical services' },
    ];

    res.json({
      success: true,
      body: { departments }
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, message: 'Failed to get departments' });
  }
});

// POST /api/users/departments - Create department
router.post('/departments', requireAuthentication, async (req, res) => {
  try {
    const { name, description } = req.body;

    res.json({
      success: true,
      message: 'Department created successfully',
      body: {
        id: Date.now(),
        name,
        description
      }
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, message: 'Failed to create department' });
  }
});

// GET /api/users/preferred-teams - List preferred terms
router.get('/preferred-teams', requireAuthentication, async (req, res) => {
  try {
    const terms = [
      { id: 1, term: 'Net 30', category: 'Payment Terms' },
      { id: 2, term: 'Net 45', category: 'Payment Terms' },
      { id: 3, term: 'Net 60', category: 'Payment Terms' },
      { id: 4, term: 'Auto-renewal', category: 'Renewal' },
      { id: 5, term: '60-day notice', category: 'Termination' },
    ];

    res.json({
      success: true,
      body: { preferred_terms: terms }
    });
  } catch (error) {
    console.error('Get preferred terms error:', error);
    res.status(500).json({ success: false, message: 'Failed to get preferred terms' });
  }
});

// File manager routes
router.get('/file-manager', requireAuthentication, async (req, res) => {
  try {
    const files = [
      { id: 1, name: 'Contracts', type: 'folder', items: 5 },
      { id: 2, name: 'Documents', type: 'folder', items: 12 },
    ];

    res.json({
      success: true,
      body: { files }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ success: false, message: 'Failed to get files' });
  }
});

// Bulk upload routes
router.post('/bulk-upload', requireAuthentication, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Bulk upload started',
      body: {
        id: Date.now(),
        status: 'processing'
      }
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ success: false, message: 'Bulk upload failed' });
  }
});

router.get('/bulk-upload/:id', requireAuthentication, async (req, res) => {
  try {
    res.json({
      success: true,
      body: {
        id: req.params.id,
        status: 'completed',
        total: 10,
        processed: 10,
        failed: 0
      }
    });
  } catch (error) {
    console.error('Get bulk upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to get bulk upload status' });
  }
});

module.exports = router;
