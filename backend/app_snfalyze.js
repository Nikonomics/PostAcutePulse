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
if (process.env.MODE === 'local') {
  server = http.createServer(app);
} else {
  options = {
    key: fs.readFileSync('/etc/letsencrypt/live/www.portacourts.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/www.portacourts.com/fullchain.pem')
  };
  server = https.createServer(options, app);
}

const corsOpts = {
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOpts));

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors(corsOpts));

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

app.use(fileUpload());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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
let socketConnection = server.listen(process.env.APP_PORT, function () {
  console.clear();
  console.log('App Server is running on  !' + process.env.APP_PORT)
});

// Set global socket
global.io = new Server(socketConnection, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


module.exports = app;
