require('dotenv').config()
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

  // Check if database is empty and seed if needed
  try {
    const userCount = await db.users.count();
    if (userCount === 0) {
      console.log('Database is empty, running seed...');
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 10);

      // Create default admin user
      await db.users.create({
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@snfalyze.com',
        password: passwordHash,
        role: 'admin',
        status: 'active',
        phone_number: '555-0100',
        department: 'Administration'
      });
      console.log('Created default admin user: admin@snfalyze.com / password123');
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
});

// Set global socket
global.io = new Server(socketConnection, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


module.exports = app;
