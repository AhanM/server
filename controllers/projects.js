'use strict';
require('dotenv').config();

// Node modules
const express = require('express');
const https = require('https');
const url = require('url');
const request = require('request');
const mongoose = require('mongoose');

const router  = express.Router();

const projRequest = require('../models/projRequest.js');

// set access tokens here
const GitHubConfig = {
  'client_id': process.env.client_id,
  'client_secret': process.env.secret,
  'redirect_uri': '',
  'scope': '',
  'state': Math.round(Math.random()*10)
};

// Use bluebird promises
mongoose.Promise = require('bluebird');

// connect to local MongoDB instance
mongoose.connect('mongodb://127.0.0.1/test');

// Define the route for the project showcase
router.get('/', (req, res) => {
  if (req.session.submitted != null) {
    const submitted = req.session.submitted;
    delete req.session.submitted;
    res.render('projects.pug', {numSubmitted: submitted});
  }
  else {
    res.render('projects.pug');
  }
});

// Define the redirect route for the Github Authorization
router.get('/redirect', (req, res) => {

  // initialize options for request
  const options = {
    hostname: 'github.com',
    path: '/login/oauth/authorize',
    method: 'GET',
    client_id: GitHubConfig.client_id,
    state: GitHubConfig.state,
    allow_signup: false
  };
  // const responseString = '';

  // define behaviour for when the request returns
  const callback = function(res) {
    const url = 'https://github.com/login/oauth/authorize'
    + '?client_id=' + GitHubConfig.client_id
    + (GitHubConfig.scope ? '&scope=' + GitHubConfig.scope : '')
    + '&state=' + GitHubConfig.state;

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,HEAD,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'content-Type,x-requested-with');
    res.redirect(url);
  };

  const reqQuery = https.request(options, (result) => {

    // console.log('statusCode:', res.statusCode);
    // console.log('headers:', res.headers);

    result.on('data', (d) => {
      process.stdout.write(d);

      // responseString = d.toString();
    });

    result.on('end', () => {

      //console.log('callback');
      callback(res); // instead of callback(res, responseString)
    });
  });

  reqQuery.on('error', (e) => {
    throw e;
  });

  reqQuery.end();
});

// Define route for Github oAuth callback
router.get('/callback', (req, res) => {

  // initalize session variable
  const sess = req.session;

  const query = url.parse(req.url, true).query;

  // authenticate absence of third party in requests
  if (query.state == GitHubConfig.state) {

  // options for the POST request
    const options = {
      url: 'https://github.com/login/oauth/access_token?client_id=' +
    GitHubConfig.client_id + '&client_secret=' +
    GitHubConfig.client_secret + '&code=' + query.code +
    (GitHubConfig.scope ? '&scope=' + GitHubConfig.scope : ''),
      headers: {'Accept': 'application/json'}
    };

  // handles access token obtain from POST request
    const callback = function(token) {

    // code to save token
      sess.access_token = token;

    // GET /user
      const opt = {
        url: 'https://api.github.com/user',
        headers: {
          'User-Agent': 'UCSD-CSES-Showcase',
          'Authorization': 'token '+token
        }
      };

      request.get(opt, (error, response, body) => {

        //console.log(response.statusCode);
        if (error)
          throw error;
        if (!error && response.statusCode == 200) {
          const username = JSON.parse(body).login;
          listRepos(username);
        }
      });

      const listRepos = function(username) {
        const options = {
          url: 'https://api.github.com/users/'+ username + '/repos',
          headers: {
            'User-Agent': 'UCSD-CSES-Showcase',
            'Authorization': 'token '+token
          }
        };
        request.get(options, (error, response, body) => {
          if (error)
            throw error;
          if (!error && response.statusCode == 200) {
            const newbody = JSON.parse(body);
            const repos = newbody.map((obj) => {
              const repo =  {
                'name' : obj.name,
                'full_name': obj.full_name,
                'Author': obj.owner.login,
                'description': obj.description,
                'stars': obj.stargazers_count };
              return repo;
            });
            sess.repos = repos;

            ///console.log(req.session);
            res.redirect('/projects/select');
          }
        });
      };
    };

  // makes a POST request for the access token
    request.post(options, (error, response, body) => {
      if (error) {
        throw error;
      }
      if (!error && response.statusCode == 200) {

        // console.log(body);
        const token = JSON.parse(body).access_token;
        callback(token);
      }
    });
  }
});

// Define the route for repo share selection
router.get('/select', (req, res) => {
  if (req.session.repos) {

    // obtain repo list from session variable
    const repos = Array.from(req.session.repos);
    res.render('select.pug', {repos: repos});
  }
  else {
    res.render('Session Timed out');
  }
});

// Define route for project showcase requests
router.post('/submit', (req, res) => {

  // res.send("Testing.....");
  const selected = Array.from(Object.keys(req.body));

  // create Project request objects from selected repos
  let index, len;
  const repos = req.session.repos;
  let count = 0;
  for (index = 0, len = repos.length; index < len; index++) {

    // if selected
    if (selected.indexOf(repos[index].name) != -1) {

      // make project request object
      const projReq = new projRequest({
        'name': repos[index].name,
        'Author': repos[index].Author,
        'description': repos[index].description,
        'stars': repos[index].stars,
        'email': 'undefined',
        'submitted': new Date(),
        'approved': false
      });

      // save to mongoDB
      projReq.save((err) => {
        if (err) throw err;
      });
      count += 1;

      // console.log(req.session.repos[index].name);
    }
  }
  delete req.session.repos;
  req.session.submitted = count;

  res.redirect('/projects');

});

router.get('/login', (req, res) => {
  res.render('adminLogin.pug');
});

router.post('/login', (req, res) => {
  if(req.body.username == 'admin' && req.body.password == 'password') 
    res.redirect('/projects/panel');
  else
    res.send('error');
});

router.get('/panel', (req, res) => {
  projRequest.find({}, function (err, docs) {
    if( docs == null) {
      res.render("panel.pug", []);
    } else {
      console.log(docs);
      res.render("panel.pug", docs);
    }
  });
  
})

module.exports = router;
