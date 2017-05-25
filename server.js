const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yargs = require('yargs');
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const passport = require('passport');
const JwtBearerStrategy = require('passport-oauth2-jwt-bearer').Strategy;
const request = require('request');
const OktaConfig = require('./js/config');

/**
 * Arguments
 */

console.log();
console.log('loading configuration...');
var argv = yargs
  .usage('\nSimple OAuth 2.0 protected resource server\n\n' +
      'Usage:\n\t$0 -iss {url} -aud {uri}', {
    port: {
      description: 'Web server listener port',
      required: true,
      alias: 'p',
      default: 8080
    },
    issuer: {
      description: 'Token Issuer URL',
      required: true,
      alias: 'iss',
      default: OktaConfig.orgUrl
    },
    audience: {
      description: 'Token Audience URI',
      required: true,
      alias: 'aud',
      default: OktaConfig.clientId
    },
    scope: {
      description: 'OAuth 2.0 Scope for Protected Resource',
      required: true,
      alias: 'scp',
      default: OktaConfig.resourceScope
    }
  })
  .example('\t$0 --iss https://example.okta.com --aud ANRZhyDh8HBFN5abN6Rg', '')
  .argv;

console.log();
console.log('Listener Port:\n\t' + argv.port);
console.log('Issuer URL:\n\t' + argv.issuer);
console.log('Audience URI:\n\t' + argv.audience);
console.log();

/**
 * Globals
 */

const metadataUrl = argv.issuer + '/.well-known/openid-configuration';
const app = express();
const httpServer = http.createServer(app);
const imgString = new Buffer(
  fs.readFileSync(path.join(__dirname, './images/oauth2.png'))
).toString('base64');


/**
 * Middleware
 */
app.set('port', argv.port);
app.use(logger('dev'));
app.use('/', express.static(__dirname));
app.use(bodyParser.json());
app.use(helmet())
app.use(passport.initialize());

/**
 * Routes
 */

app.get('/claims',
  passport.authenticate('oauth2-jwt-bearer', { session: false }),
  function(req, res) {
    res.json(req.user);
  });

app.get('/protected',
  passport.authenticate('oauth2-jwt-bearer', { scopes: argv.scope, session: false }),
  function(req, res) {
    console.log('Accessing protected resource as ' + req.user.sub);
    res.set('Content-Type', 'application/x-octet-stream');
    res.send(imgString);
  });

/**
 * Fetch metadata to obtain JWKS signing keys
 */

console.log('fetching issuer metadata configuration from %s...', metadataUrl);
request({
  json: true,
  uri: metadataUrl,
  strictSSL: true
}, function(err, res, body) {
  if (err || res.statusCode < 200 || res.statusCode >= 300) {
    console.log('Unable to fetch issuer metadata configuration due to HTTP Error: %s ', res.statusCode);
    return process.exit(1);
  }

/**
 * Configure JwtBearerStrategy with JWKS
 */

 console.log('trusting tokens signed with keys from %s...', res.body.jwks_uri);
  passport.use(new JwtBearerStrategy({
    issuer: argv.issuer,
    audience: argv.audience,
    realm: 'OKTA',
    jwksUrl: res.body.jwks_uri
  }, function(token, done) {
    // done(err, user, info)
    return done(null, token);
  }));

/**
 * Start Server
 */

  console.log();
  console.log('starting server...');
  httpServer.listen(app.get('port'), function() {
    var scheme   = argv.https ? 'https' : 'http',
        address  = httpServer.address(),
        hostname = os.hostname();
        baseUrl  = address.address === '0.0.0.0' ?
          scheme + '://' + hostname + ':' + address.port :
          scheme + '://localhost:' + address.port;

    console.log('listening on port: ' + app.get('port'));
    console.log();
  });

});








