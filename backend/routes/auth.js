var express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const User = db.users;
var router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'snfalyze-local-dev-secret-key-12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'snfalyze-refresh-secret-key-12345';

// Store OTPs temporarily (in production, use Redis)
const otpStore = {};

// Generate random OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate tokens (wrap in data object to match passport expectation)
    const accessToken = jwt.sign(
      { data: { id: user.id, email: user.email } },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { data: { id: user.id, email: user.email } },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      body: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          role_id: user.role_id || 1,
          roles: user.role || 'admin', // Include the role string
          role_type: user.role === 'admin' ? 0 : 2, // Admin = 0, others = 2
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// POST /api/auth/google-login
router.post('/google-login', async (req, res) => {
  try {
    const { email, full_name, google_id } = req.body;

    // Find or create user
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user
      const hashedPassword = await bcrypt.hash(google_id || 'google-auth', 10);
      user = await User.create({
        email,
        full_name,
        password: hashedPassword,
        is_verified: true,
      });
    }

    // Generate tokens (wrap in data object to match passport expectation)
    const accessToken = jwt.sign(
      { data: { id: user.id, email: user.email } },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { data: { id: user.id, email: user.email } },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Google login successful',
      body: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role_id: user.role_id || 1,
        }
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ success: false, message: 'Google login failed' });
  }
});

// POST /api/auth/verify-user - Send OTP
router.post('/verify-user', async (req, res) => {
  try {
    const { email } = req.body;

    // Generate OTP
    const otp = generateOTP();
    otpStore[email] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    };

    console.log(`OTP for ${email}: ${otp}`); // For development

    // Generate OTP token
    const otpToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '5m' });

    res.json({
      success: true,
      message: 'OTP sent successfully',
      body: {
        otp_token: otpToken,
        // Include OTP in response for development (remove in production)
        dev_otp: otp
      }
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const stored = otpStore[email];
    if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Clear OTP
    delete otpStore[email];

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    // Generate new OTP
    const otp = generateOTP();
    otpStore[email] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    };

    console.log(`New OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP resent successfully',
      body: {
        dev_otp: otp
      }
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend OTP' });
  }
});

// POST /api/auth/forget-password
router.post('/forget-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    otpStore[`reset_${email}`] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    };

    console.log(`Password reset OTP for ${email}: ${otp}`);

    const otpToken = jwt.sign({ email, type: 'reset' }, JWT_SECRET, { expiresIn: '5m' });

    res.json({
      success: true,
      message: 'Password reset OTP sent',
      body: {
        otp_token: otpToken,
        dev_otp: otp
      }
    });
  } catch (error) {
    console.error('Forget password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
});

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader && authHeader.split(' ')[1];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Generate new access token
    const accessToken = jwt.sign(
      { data: { id: decoded.data.id, email: decoded.data.email } },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      body: {
        access_token: accessToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

module.exports = router;
