'use strict';
require('dotenv').config();

// Node modules
const express = require('express');
const session = require('express-session');
const path = require('path');
const https = require('https');
const url = require('url');
const request = require('request');

const router  = express.Router();

// set access tokens here
var GitHubConfig = {
  'client_id': process.env.client_id,
  'client_secret': process.env.secret,
  'redirect_uri': '',
  'scope': '',
  'state': Math.round(Math.random()*10)
}

// Define the route for the project showcase
router.get('/', (req, res) => {
  res.render("projects.pug");
});

// Define the redirect route for the Github Authorization
// initialize options for request
router.get('/redirect', (req, res) => {
  var options = {
    hostname: 'github.com',
    path: '/login/oauth/authorize',
    method: 'GET',
    client_id: GitHubConfig.client_id,
    state: GitHubConfig.state,
    allow_signup: false,
  }
  var responseString = ''

  // define behaavior for when the request returns
  var callback = function(res, text) {
    var url = 'https://github.com/login/oauth/authorize'
    + '?client_id=' + GitHubConfig.client_id
    + (GitHubConfig.scope ? '&scope=' + GitHubConfig.scope : '')
    + '&state=' + GitHubConfig.state

    res.header('Access-Control-Allow-Origin', "*")
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,HEAD,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'content-Type,x-requested-with')
    res.redirect(url)
  }

  var req = https.request(options, (result) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);

    result.on('data', (d) => {
      process.stdout.write(d);
      responseString = d.toString()
    });

    result.on('end', function() {
      console.log('callback')
      callback(res, responseString)
    })
  })

  req.on('error', (e) => {
    console.error(e);
  })

  req.end();
});

router.get('/callback', (req, res) => {
  // initalize session variable
  var sess = req.session

  var query = url.parse(req.url, true).query

  // authenticate absence of third party in requests
  if (query.state == GitHubConfig.state) {

  // options for the POST request
  var options = {
    url: 'https://github.com/login/oauth/access_token?client_id=' +
    GitHubConfig.client_id + '&client_secret=' +
    GitHubConfig.client_secret + '&code=' + query.code +
    (GitHubConfig.scope ? '&scope=' + GitHubConfig.scope : ''),
    headers: {'Accept': 'application/json'}
  }
  // handles access token obtain from POST request
  var callback = function(token) {
    // code to save token
    sess.access_token = token

    // GET /user
    var opt = {
      url: 'https://api.github.com/user',
      headers: {
        'User-Agent': 'UCSD-CSES-Showcase',
        'Authorization': 'token '+token
      }
    }

    request.get(opt, function(error, response, body) {
      console.log(response.statusCode)
      if(error)
        console.error(error)
      if(!error && response.statusCode == 200) {
        var username = JSON.parse(body).login
        listRepos(username)
      }
    })

    var listRepos = function(username) {
      var options = {
        url: 'https://api.github.com/users/'+ username + '/repos',
        headers: {
          'User-Agent': 'UCSD-CSES-Showcase',
          'Authorization': 'token '+token
        }
      }
      request.get(options, function(error, response, body) {
        if(error)
          console.error(error)
        if (!error && response.statusCode == 200) {
          var newbody = JSON.parse(body)
          var repos = newbody.map((obj) => {
            return obj.name
          })
          sess.repos = repos
          console.log(req.session)
          res.redirect('/projects/select')
        }
      })
    }
  }

  // makes a POST request for the access token
  request.post(options, function (error, response, body) {
    if (error) {
      console.error(error)
    }
    if (!error && response.statusCode == 200) {
      console.log(body)
      var token = JSON.parse(body).access_token
      callback(token)
    }
  })
  }
});

// Define the route for repo share selection
router.get('/select', (req, res) => {
  if(req.session.repos) {
    // obtain repo list from session variable
    var repos = Array.from(req.session.repos);
    res.render('select.pug', {repos: repos});
  } else {
    res.render('Session Timed out');
  }
});

module.exports = router;
