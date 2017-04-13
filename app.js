'use strict';
require('dotenv').config({silent: true});

// Node modules
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const compression = require('compression');
const engines = require('consolidate');
const session = require('express-session');

// Custom modules
const log = require('./log');
const reqLog = require('./middleware/req-logger');
const errorHandler = require('./middleware/error-handler');
const fbEvents = require('./controllers/fbEvents');
const projects = require('./controllers/projects');

/////////////////////////////////////////////////////////////////////

const app = express();
const publicDir = path.join(__dirname, 'public');

// Allow multiple templating engines
app.engine('pug', engines.pug);

// Setup session configuration
app.set('trusted proxy', 1);
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: {maxAge: 600000}
}));

// Register middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(reqLog);
app.use(compression({ threshold: 0 }));

// Entire website is currently static pages, so this covers all routes
app.use(express.static('public'));
app.use('/fb-events', fbEvents);
app.use('/projects', projects);

/////////////////////////////////////////////////////////////////////

// Register error handling middleware last to catch unhandled requests

// 404 errors
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// 500 errors
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Export the app so it can be tested
module.exports = app.listen(PORT, () => {
  log.info('Server listening on port', PORT);
});
