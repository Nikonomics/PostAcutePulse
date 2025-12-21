require('dotenv').config()
// Force redeploy - database schema updated 2025-12-18
var createError = require('http-errors');
var express = require('express');
var bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require("cors");
var app = express();
var fs = require('fs');
var http = require('http');
var https = require('https');
var options = {};
var server;

// For database access in socket event
const db = require('./models');
const EventMatchesScore = db.event_matches_score;
const EventMatches = db.event_matches;

// Sync database tables on startup and seed if empty
// Note: Using sync() without alter for SQLite compatibility
// alter: true causes issues with SQLite backup table creation
db.sequelize.sync().then(async () => {
  console.log('Database synced successfully');

  // Run migrations for missing columns
  try {
    const [results] = await db.sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'deal_facilities' AND column_name = 'county'
    `);

    if (results.length === 0) {
      console.log('Adding missing county column to deal_facilities...');
      await db.sequelize.query(`
        ALTER TABLE deal_facilities ADD COLUMN IF NOT EXISTS county VARCHAR(255)
      `);
      console.log('Added county column to deal_facilities');
    }
  } catch (migrationErr) {
    console.error('Migration check error:', migrationErr.message);
  }

  // Ensure default admin user exists
  try {
    const bcrypt = require('bcryptjs');
    const adminEmail = 'admin@snfalyze.com';

    const existingAdmin = await db.users.findOne({ where: { email: adminEmail } });

    if (!existingAdmin) {
      console.log('Creating default admin user...');
      const passwordHash = await bcrypt.hash('password123', 10);

      await db.users.create({
        first_name: 'Admin',
        last_name: 'User',
        email: adminEmail,
        password: passwordHash,
        role: 'admin',
        status: 'active',
        phone_number: '555-0100',
        department: 'Administration'
      });
      console.log('Created default admin user: admin@snfalyze.com / password123');
    } else {
      console.log('Default admin user already exists');
    }
  } catch (seedErr) {
    console.error('Auto-seed check error:', seedErr);
  }
}).catch(err => {
  console.error('Database sync error:', err);
});

// Server setup - HTTP for Render/local, HTTPS only for specific deployments
if (process.env.MODE === 'local' || process.env.NODE_ENV === 'production') {
  // Use HTTP for local dev and Render (Render handles SSL termination)
  server = http.createServer(app);
} else if (fs.existsSync('/etc/letsencrypt/live/www.portacourts.com/privkey.pem')) {
  options = {
    key: fs.readFileSync('/etc/letsencrypt/live/www.portacourts.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/www.portacourts.com/fullchain.pem')
  };
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}

const corsOpts = {
  origin: true, // Reflects the request origin - works with credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOpts));

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors(corsOpts));

// Add explicit CORS headers as fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/authentication');
var dealRouter = require('./routes/deal');
var stateRouter = require('./routes/stateRouter');
var DealController = require('./controller/DealController');

// New routes for Cascadia Contract Management
var apiAuthRouter = require('./routes/auth');
var apiUsersRouter = require('./routes/apiUsers');
var contractsRouter = require('./routes/contracts');
var taxonomyRouter = require('./routes/taxonomy');
var dueDiligenceRouter = require('./routes/dueDiligence');
var facilitiesRouter = require('./routes/facilities');
var marketRouter = require('./routes/market');
var wagesRouter = require('./routes/wages');
var marketsRouter = require('./routes/markets');
var ownershipRouter = require('./routes/ownership');
var maAnalyticsRouter = require('./routes/ma-analytics');
var savedItemsRouter = require('./routes/savedItems');
var userRouter = require('./routes/user');
var surveyIntelligenceRouter = require('./routes/surveyIntelligence');

app.use(fileUpload());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/deal', dealRouter);
app.use('/api/v1/states', stateRouter);

// Cascadia Contract Management API routes
app.use('/api/auth', apiAuthRouter);
app.use('/api/users', apiUsersRouter);
app.use('/api/users/contracts', contractsRouter);

// Taxonomy API routes (facilities, categories, document types, vendors, etc.)
app.use('/api', taxonomyRouter);

// Due Diligence API routes
app.use('/api/due-diligence', dueDiligenceRouter);

// ALF Facilities API routes
app.use('/api/facilities', facilitiesRouter);
app.use('/api/v1/facilities', facilitiesRouter);

// Market Dynamics API routes (available at both /api/market and /api/v1/market)
app.use('/api/market', marketRouter);
app.use('/api/v1/market', marketRouter);

// BLS Wages API routes
app.use('/api/wages', wagesRouter);

// CBSA Markets API routes
app.use('/api/markets', marketsRouter);

// Ownership Research API routes
app.use('/api/v1/ownership', ownershipRouter);

// M&A Analytics API routes
app.use('/api/ma-analytics', maAnalyticsRouter);

// Survey Intelligence API routes
app.use('/api/v1/survey-intelligence', surveyIntelligenceRouter);

// Saved Items API routes (bookmarks for deals, facilities, markets)
app.use('/api/v1/saved-items', savedItemsRouter);

// User API routes (activity feed, associated deals)
app.use('/api/v1/user', userRouter);

// File serving route for uploaded documents
app.get('/api/v1/files/*', DealController.serveFile);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// --- SOCKET.IO SETUP ---
const { Server } = require('socket.io');
const PORT = process.env.PORT || process.env.APP_PORT || 5000;
let socketConnection = server.listen(PORT, function () {
  console.log('App Server is running on port ' + PORT);

  // Quarterly Census data auto-refresh check (runs in background after startup)
  setTimeout(async () => {
    try {
      const censusService = require('./services/censusDataRefreshService');
      await censusService.autoRefreshIfNeeded();
    } catch (err) {
      console.error('[Census] Auto-refresh check failed:', err.message);
    }
  }, 5000); // Wait 5 seconds after server start before checking
});

// Set global socket
global.io = new Server(socketConnection, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handler for user-specific rooms
global.io.on('connection', (socket) => {
  console.log('[Socket.IO] Client connected:', socket.id);

  // Join user-specific room when authenticated
  socket.on('join', (userId) => {
    if (userId) {
      const room = `user_${userId}`;
      socket.join(room);
      console.log(`[Socket.IO] User ${userId} joined room: ${room}`);
    }
  });

  // Leave room on disconnect
  socket.on('disconnect', () => {
    console.log('[Socket.IO] Client disconnected:', socket.id);
  });
});

module.exports = app;
