define(['q', 'jquery'], function(Q, $) {

/* Base64.js
 *
 * Copyright 2015 David Chambers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
!function(){function t(t){this.message=t}var r="undefined"!=typeof exports?exports:this,e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";t.prototype=new Error,t.prototype.name="InvalidCharacterError",r.btoa||(r.btoa=function(r){for(var o,n,a=String(r),i=0,c=e,d="";a.charAt(0|i)||(c="=",i%1);d+=c.charAt(63&o>>8-i%1*8)){if(n=a.charCodeAt(i+=.75),n>255)throw new t("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");o=o<<8|n}return d}),r.atob||(r.atob=function(r){var o=String(r).replace(/=+$/,"");if(o.length%4==1)throw new t("'atob' failed: The string to be decoded is not correctly encoded.");for(var n,a,i=0,c=0,d="";a=o.charAt(c++);~a&&(n=i%4?64*n+a:a,i++%4)?d+=String.fromCharCode(255&n>>(-2*i&6)):0)a=e.indexOf(a);return d})}(); // jshint ignore:line

/* globals process, console, Q, JSON, escape */

var LOG_PREFIX = '[OktaAuth]';
var STATE_TOKEN_COOKIE_NAME = 'oktaStateToken';
var DEFAULT_POLLING_DELAY = 500;
var DEBUG = false;
var IS_NODE = 'object' === typeof process && Object.prototype.toString.call(process) === '[object process]';
var IS_BROWSER = !IS_NODE;
var SDK_VERSION = '1.0';
var FRAME_ID = 'okta-oauth-helper-frame';
var RANDOM_CHARSET = 'abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';


function AuthApiError(err, xhr) {
  this.name = 'AuthApiError';
  this.message = err.errorSummary;
  this.errorSummary = err.errorSummary;
  this.errorCode = err.errorCode;
  this.errorLink = err.errorLink;
  this.errorId = err.errorId;
  this.errorCauses = err.errorCauses;

  if (xhr) {
    this.xhr = xhr;
  }
}
AuthApiError.prototype = new Error();

function AuthSdkError(msg, xhr) {
  this.name = 'AuthSdkError';
  this.message = msg;

  this.errorCode = 'INTERNAL';
  this.errorSummary = msg;
  this.errorLink = 'INTERNAL';
  this.errorId = 'INTERNAL';
  this.errorCauses = [];
  if (xhr) {
    this.xhr = xhr;
  }
}
AuthSdkError.prototype = new Error();

function OAuthError(errorCode, description) {
  this.name = 'OAuthError';
  this.code = errorCode;
  this.message = description;
}
OAuthError.prototype = new Error();


// LOGGING
function print(fn, args) {
  if (DEBUG) {
    var consoleArgs = Array.prototype.slice.call(args);
    consoleArgs.unshift(LOG_PREFIX + ' ');
    fn.apply(console, consoleArgs);
  }
}

function log() {
  if (typeof console !== 'undefined' && console.log) {
    return print(console.log, arguments);
  }
}

function error() {
  if (typeof console !== 'undefined' && console.error) {
    return print(console.error, arguments);
  }
}

// UTILS
function isAbsoluteUrl(url) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

function isString(obj) {
  return Object.prototype.toString.call(obj) === '[object String]';
}

function isoToDate(str) {
  var parts = str.match(/\d+/g),
      isoTime = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]),
      isoDate = new Date(isoTime);

  return isoDate;
}

function clone(obj) {
  var str = JSON.stringify(obj);
  if (str) {
    return JSON.parse(str);
  }
}

function find(collection, searchParams) {
  var c = collection.length;
  while (c--) {
    var item = collection[c];
    var found = true;
    for (var prop in searchParams) {
      if (!searchParams.hasOwnProperty(prop)) {
        continue;
      }
      if (item[prop] !== searchParams[prop]) {
        found = false;
        break;
      }
    }
    if (found) {
      return item;
    }
  }
}

function contains(array, needle) {
  if(typeof Array.prototype.indexOf === 'function') {
      indexOf = Array.prototype.indexOf;
  } else {
    indexOf = function(needle) {
      var i = -1, index = -1;

      for(i = 0; i < this.length; i++) {
        if(this[i] === needle) {
          index = i;
          break;
        }
      }

      return index;
    };
  }

  return indexOf.call(array, needle) >= 0;
};

function getLink(obj, linkName, altName) {
  if (!obj || !obj._links) {
    return;
  }

  var link = obj._links[linkName];

  // If a link has a name and we have an altName, return if they match
  if (link && link.name && altName) {
    if (link.name === altName) {
      return link;
    }
  } else {
    return link;
  }
}

function setCookie(name, value, expiresAt) {
  if (!IS_BROWSER) {
    return;
  }

  var expiresText = '';
  if (expiresAt) {
    expiresText = ' expires=' + isoToDate(expiresAt).toUTCString() + ';';
  }

  var cookieText = name + '=' + value + ';' + expiresText;
  log('Set cookie: ' + cookieText);
  document.cookie = cookieText;

  return cookieText;
}

function getCookie(name) {
  if (!IS_BROWSER) {
    return;
  }

  var pattern = new RegExp(name + '=([^;]*)'),
    matched = document.cookie.match(pattern);

  if (matched) {
    var cookie = matched[1];
    log('Got cookie: ', cookie);
    return cookie;
  }
}

function deleteCookie(name) {
  setCookie(name, '', '1970-01-01T00:00:00Z');
}

function addStateToken(sdk, options) {
  var builtArgs = clone(options) || {};

  // Add the stateToken if one isn't passed and we have one
  if (!builtArgs.stateToken && sdk.lastResponse && sdk.lastResponse.stateToken) {
    builtArgs.stateToken = sdk.lastResponse.stateToken;
  }

  return builtArgs;
}

function getStateToken(sdk) {
  return addStateToken(sdk);
}

function callSubscribedFn(sdk, err, res) {
  if (err === null) {
    err = undefined;
  }

  if (sdk.subscribedFn) {
    // Call the function outside of the current promise chain
    setTimeout(function() {
      sdk.subscribedFn(err, res);
    }, 0);
  }
}

function getCancelFn(sdk) {
  function cancel() {
    sdk.isPolling = false;
    var cancelLink = getLink(sdk.lastResponse, 'cancel');
    return sdk.post(cancelLink.href, getStateToken(sdk))
      .then(function(res) {
        sdk.resetState();
        return res;
      });
  }
  return cancel;
}

function getPreviousFn(sdk) {
  function previous() {
    sdk.isPolling = false;
    var previousLink = getLink(sdk.lastResponse, 'prev');
    return sdk.post(previousLink.href, getStateToken(sdk));
  }
  return previous;
}

function getPollFn(sdk) {
  return function (delay) {
    if (!delay && delay !== 0) {
      delay = DEFAULT_POLLING_DELAY;
    }

    // Get the poll function
    var pollLink = getLink(sdk.lastResponse, 'next', 'poll');
    var pollFn = function() {
      return sdk.post(pollLink.href, getStateToken(sdk), true, true);
    };

    sdk.isPolling = true;

    var recursivePoll = function () {

      // If the poll was manually stopped during the delay
      if (!sdk.isPolling) {
        return Q.resolve();
      }

      return pollFn()
        .then(function (res) {

          // If we're still waiting
          if (res.factorResult && res.factorResult === 'WAITING') {

            // If the poll was manually stopped while the pollFn was called
            if (!sdk.isPolling) {
              return;
            }

            // Continue poll
            return Q.delay(delay)
              .then(recursivePoll);

          } else {
            // Any non-waiting result, even if polling was stopped
            // during a request, will return
            sdk.isPolling = false;
            callSubscribedFn(sdk, null, res);
            sdk.lastResponse = res;
            setState(sdk, res.status);
            return res;
          }
        });
    };
    return recursivePoll()
      .fail(function(err) {
        sdk.isPolling = false;
        callSubscribedFn(sdk, err);
        throw err;
      });
  };
}

function queryParamSerialize(obj) {
  var str = [];
  if (obj !== null) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(key + '=' + encodeURIComponent(obj[key]));
      }
    }
  }

  return '?' + str.join('&');
}

function queryParamDeserialize(query) {
  var match,
    pl = /\+/g,  // Regex for replacing addition symbol with a space
    search = /([^&=]+)=?([^&]*)/g,
    decode = function (s) {
        return decodeURIComponent(s.replace(pl, ' '));
    },
    obj = {};
  match = search.exec(query);
  while (match) {
    obj[decode(match[1])] = decode(match[2]);
    match = search.exec(query);
  }

  return obj;
};

function getHash(hash) {
  if (hash.indexOf('#/') > -1) {
      hash = hash.substring(hash.indexOf('#/') + 2);
  } else if (hash.indexOf('#') > -1) {
      hash = hash.substring(1);
  }

  return hash;
};

/* jshint ignore:start */
function genRandom(length) {
  var random = '';
  for (var i = 0, n = RANDOM_CHARSET.length; i < length; ++i) {
    random += RANDOM_CHARSET.charAt(Math.floor(Math.random() * n));
  }
  return random;
}

function addFrame(iframeId) {
  if (typeof iframeId === 'undefined') {
    return;
  }

  var frameEl = document.getElementById(iframeId);

  if (!frameEl) {
    if (document.createElement && document.documentElement &&
      (window.opera || window.navigator.userAgent.indexOf('MSIE 5.0') === -1)) {
      var ifr = document.createElement('iframe');
      ifr.setAttribute('id', iframeId);
      ifr.style.visibility = 'hidden';
      ifr.style.position = 'absolute';
      ifr.style.width = ifr.style.height = ifr.borderWidth = '0px';

      frameEl = document.getElementsByTagName('body')[0].appendChild(ifr);
    }
    else if (document.body && document.body.insertAdjacentHTML) {
      document.body.insertAdjacentHTML('beforeEnd', '<iframe name="' +
        iframeId + '" id="' + iframeId + '" style="display:none"></iframe>');
    }
    if (window.frames && window.frames[iframeId]) {
      frameEl = window.frames[iframeId];
    }
  }

  return frameEl;
}

function loadFrame(frameSrc, frameName) {
  // This trick overcomes iframe navigation in IE
  // IE does not load the page consistently in iframe
  var self = this;
  log('LoadFrame: ' + frameName);
  var frameCheck = frameName;
  setTimeout(function () {
    var frameHandle = addFrame(frameCheck);
    if (frameHandle.src === '' || frameHandle.src === 'about:blank') {
      frameHandle.src = frameSrc;
      loadFrame(frameSrc, frameCheck);
    }
  }, 250);
}
/* jshint ignore:end */


// STATE DEFINITIONS
var STATE_MAP = {};

STATE_MAP['INITIAL'] = function (sdk) {
  return {

    // { username, password, (relayState), (context) }
    primaryAuth: function (options) {
      return sdk.post('/api/v1/authn', options);
    },

    // { username, (relayState) }
    forgotPassword: function (options) {
      return sdk.post('/api/v1/authn/recovery/password', options);
    },

    // { username, (relayState) }
    unlockAccount: function (options) {
      return sdk.post('/api/v1/authn/recovery/unlock', options);
    },

    // { recoveryToken }
    verifyRecoveryToken: function (options) {
      return sdk.post('/api/v1/authn/recovery/token', options);
    }
  };
};

STATE_MAP['RECOVERY'] = function (sdk) {
  var answerLink = getLink(sdk.lastResponse, 'next', 'answer');
  if (answerLink) {
    return {

      // { answer }
      answerRecoveryQuestion: function (options) {
        var data = addStateToken(sdk, options);
        return sdk.post(answerLink.href, data);
      },

      // no arguments
      cancel: getCancelFn(sdk)
    };

  } else {
    return {

      // { recoveryToken }
      verifyRecoveryToken: function (options) {
        var recoveryLink = getLink(sdk.lastResponse, 'next', 'recovery');
        return sdk.post(recoveryLink.href, options);
      },

      // no arguments
      cancel: getCancelFn(sdk)
    };
  }
};

STATE_MAP['RECOVERY_CHALLENGE'] = function (sdk) {
  // This state has some responses without _links.
  // Without _links, we emulate cancel to make it
  // intuitive to return to the INITIAL state. We
  // may remove this when OKTA-75434 is resolved
  if (!sdk.lastResponse._links) {
    return {
      cancel: function() {
        return new Q(sdk.resetState());
      }
    };
  }

  return {

    // { passCode }
    verifyRecovery: function(options) {
      var data = addStateToken(sdk, options);
      var verifyLink = getLink(sdk.lastResponse, 'next', 'verify');

      return sdk.post(verifyLink.href, data);
    },

    resendByName: function(name) {
      var resendLink = getLink(sdk.lastResponse, 'resend', name);
      if (!resendLink) {
        var err = new AuthSdkError('"' + name + '" is not a valid name for recovery');
        return Q.reject(err);
      }
      return sdk.post(resendLink.href, getStateToken(sdk));
    },

    // no arguments
    cancel: getCancelFn(sdk)
  };
};

STATE_MAP['LOCKED_OUT'] = function (sdk) {
  return {

    // { username, (relayState) }
    unlockAccount: function (options) {
      var unlockLink = getLink(sdk.lastResponse, 'next', 'unlock');
      return sdk.post(unlockLink.href, options);
    },

    // no arguments
    cancel: getCancelFn(sdk)
  };
};

STATE_MAP['PASSWORD_EXPIRED'] = function (sdk) {
  return {

    // { newPassword }
    changePassword: function (options) {
      var data = addStateToken(sdk, options);
      var passwordLink = getLink(sdk.lastResponse, 'next', 'changePassword');
      return sdk.post(passwordLink.href, data);
    },

    // no arguments
    cancel: getCancelFn(sdk)
  };
};

STATE_MAP['PASSWORD_WARN'] = function (sdk) {
  return {

    // { newPassword }
    changePassword: function (options) {
      var data = addStateToken(sdk, options);
      var passwordLink = getLink(sdk.lastResponse, 'next', 'changePassword');
      return sdk.post(passwordLink.href, data);
    },

    // no arguments
    skip: function () {
      var skipLink = getLink(sdk.lastResponse, 'skip', 'skip');
      return sdk.post(skipLink.href, getStateToken(sdk));
    },

    // no arguments
    cancel: getCancelFn(sdk)
  };
};

STATE_MAP['PASSWORD_RESET'] = function (sdk) {
  return {

    // { newPassword }
    resetPassword: function (options) {
      var data = addStateToken(sdk, options);
      var passwordLink = getLink(sdk.lastResponse, 'next', 'resetPassword');
      return sdk.post(passwordLink.href, data);
    },

    // no arguments
    cancel: getCancelFn(sdk)
  };
};

STATE_MAP['MFA_ENROLL'] = function (sdk) {
  var methods = {

    // no arguments
    cancel: getCancelFn(sdk),

    getFactorByTypeAndProvider: function (type, provider) {

      var factor = find(sdk.lastResponse._embedded.factors, { factorType: type, provider: provider });
      if (!factor) {
        var err = 'No factor with a type of ' + type + ' and a provider of ' + provider;
        error(err);
        throw new AuthSdkError(err);
      }

      var factorMethods = {

        /*
          Append the profile property to the factor
          Type                | Profile
          question            | { question, answer }
          sms                 | { phoneNumber, updatePhone }
          token:software:totp | no profile
          push                | no profile
        */
        enrollFactor: function(options) {
          var enrollLink = getLink(factor, 'enroll');
          var data = clone(options) || {};

          if (data.profile && data.profile.updatePhone !== undefined) {
            if (data.profile.updatePhone) {
              enrollLink.href += '?updatePhone=true';
            }
            delete data.profile.updatePhone;
          }

          data.factorType = type;
          data.provider = provider;

          data = addStateToken(sdk, data);
          return sdk.post(enrollLink.href, data);
        }
      };

      if (type === 'question') {
        // no arguments
        factorMethods.getQuestions = function() {
          var questionLink = getLink(factor, 'questions');
          return sdk.get(questionLink.href);
        };
      }

      return factorMethods;
    }
  };

  var skipLink = getLink(sdk.lastResponse, 'skip');
  if (skipLink) {
    methods.skip = function() {
      return sdk.post(skipLink.href, getStateToken(sdk));
    };
  }

  return methods;
};

STATE_MAP['MFA_ENROLL_ACTIVATE'] = function (sdk) {

  // Default methods for MFA_CHALLENGE states
  var methods = {

    // no arguments
    previous: getPreviousFn(sdk),

    // no arguments
    cancel: getCancelFn(sdk)
  };

  var pollLink = getLink(sdk.lastResponse, 'next', 'poll');
  if (pollLink) {

    // polls until factorResult changes
    // optional polling interval in millis
    methods.startEnrollFactorPoll = getPollFn(sdk);

    // no arguments
    methods.stopEnrollFactorPoll = function() {
      sdk.isPolling = false;
    };

  } else {

    /*
        Just send the profile
        Type                | Profile
        sms                 | { passCode }
        token:software:totp | { passCode }
        push                | no profile
    */
    methods.activateFactor = function(options) {
      var data = addStateToken(sdk, options);
      var activateLink = getLink(sdk.lastResponse, 'next', 'activate');
      return sdk.post(activateLink.href, data);
    };
  }

  var resendLinks = getLink(sdk.lastResponse, 'resend');
  if (resendLinks) {
    methods.resendByName = function(name) {
      var resendLink = find(resendLinks, { name: name });
      return sdk.post(resendLink.href, getStateToken(sdk));
    };
  }

  return methods;
};

STATE_MAP['MFA_REQUIRED'] = function (sdk) {
  return {

    // no arguments
    cancel: getCancelFn(sdk),

    getFactorById: function (id) {
      var factor = find(sdk.lastResponse._embedded.factors, { id: id });
      if (!factor) {
        var err = 'No factor with an id of ' + id;
        error(err);
        throw new AuthSdkError(err);
      }

      return {

        /*
          Just send the profile
          Type                | Profile
          question            | { answer }
          sms (send passCode) | no arguments
          sms (validate)      | { passCode }
          token:software:totp | { passCode }
          push                | no arguments
        */
        verifyFactor: function(options) {
          var data = addStateToken(sdk, options);
          var verifyLink = getLink(factor, 'verify');

          if (data && data.rememberDevice !== undefined) {
            if (data.rememberDevice) {
              verifyLink.href += '?rememberDevice=true';
            }
            delete data.rememberDevice;
          }

          return sdk.post(verifyLink.href, data);
        }
      };
    }
  };
};


STATE_MAP['MFA_CHALLENGE'] = function (sdk) {

  // Default methods for MFA_CHALLENGE states
  var methods = {

    // no arguments
    previous: getPreviousFn(sdk),

    // no arguments
    cancel: getCancelFn(sdk)
  };

  var pollLink = getLink(sdk.lastResponse, 'next', 'poll');

  if (pollLink) {

    // polls until factorResult changes
    // optional polling interval in millis
    methods.startVerifyFactorPoll = getPollFn(sdk);

    // no arguments
    methods.stopVerifyFactorPoll = function() {
      sdk.isPolling = false;
    };

  } else {

    /*
      Just send the profile
      Type                | Profile
      question            | { answer }
      token:software:totp | { passCode }
    */
    methods.verifyFactor = function(options) {
      var data = addStateToken(sdk, options);
      var verifyLink = getLink(sdk.lastResponse, 'next', 'verify');

      if (data.rememberDevice !== undefined) {
        if (data.rememberDevice) {
          verifyLink.href += '?rememberDevice=true';
        }
        delete data.rememberDevice;
      }

      return sdk.post(verifyLink.href, data);
    };
  }

  var resendLinks = getLink(sdk.lastResponse, 'resend');
  if (resendLinks) {
    methods.resendByName = function(name) {
      var resendLink = find(resendLinks, { name: name });
      return sdk.post(resendLink.href, getStateToken(sdk));
    };
  }

  return methods;
};

function setState(sdk, state) { /* jshint ignore: line */

  if (STATE_MAP[state]) {
    sdk.current = STATE_MAP[state](sdk);
  } else {
    sdk.current = {};
  }
  sdk.state = state;
}

// HTTP METHODS

function httpRequest(sdk, url, method, args, preventBroadcast, dontSaveResponse) {
  var self = sdk;
  var options = {
    headers: self.headers,
    data: args || undefined
  };

  log('Request: ', method, url, options);

  var err, res;
  return new Q(self.ajaxRequest(method, url, options))
    .then(function(resp) { /* jshint ignore: line */
      log('Response: ', resp);

      res = resp.responseText;
      if (isString(res)) {
        res = JSON.parse(res);
      }

      if (!dontSaveResponse) {
        log('Last response set');
        self.lastResponse = res;

        if (!res.stateToken) {
          deleteCookie(STATE_TOKEN_COOKIE_NAME);
        }
      }

      if (res && res.stateToken && res.expiresAt) {
        setCookie(STATE_TOKEN_COOKIE_NAME, res.stateToken, res.expiresAt);
      }

      if (res && res.status) {
        setState(sdk, res.status);
      }

      return res;
    })

    // jshint maxcomplexity:7
    .fail(function(resp) {
      var serverErr = resp.responseText || {};
      if (isString(serverErr)) {
        try {
          serverErr = JSON.parse(serverErr);
        } catch (e) {
          serverErr = {
            errorSummary: 'Unknown error'
          };
        }
      }

      if (resp.status >= 500) {
        serverErr.errorSummary = 'Unknown error';
      }

      error('Error: ' + resp);

      if (sdk.transformErrorXHR) {
        resp = sdk.transformErrorXHR(clone(resp));
      }

      err = new AuthApiError(serverErr, resp);

      if (err.errorCode === 'E0000011') {
        deleteCookie(STATE_TOKEN_COOKIE_NAME);
      }

      throw err;
    })

    .fin(function() {
      if (!preventBroadcast) {
        callSubscribedFn(sdk, err, res);
      }
    });
}

function OktaAuth(args) { // jshint ignore:line

  if (!(this instanceof OktaAuth)) {
    return new OktaAuth(args);
  }

  if (!args) {
    throw new AuthSdkError('OktaAuth must be provided arguments');
  }

  if (!args.uri) {
    throw new AuthSdkError('OktaAuth must be provided a uri');
  }

  DEBUG = args.debug;

  this.uri = args.uri;

  // Remove trailing forward slash
  if (this.uri.slice(-1) === '/') {
    this.uri = this.uri.slice(0, -1);
  }

  this.apiToken = args.apiToken;
  this.clientId = args.clientId;
  this.redirectUri = args.redirectUri;
  this.authorizeUrl = this.uri + '/oauth2/v1/authorize';
  this.tokenUrl = this.uri + '/oauth2/v1/token';
  this.ajaxRequest = args.ajaxRequest || this.ajaxRequest;
  this.transformErrorXHR = args.transformErrorXHR;

  this.headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Okta-SDK-SKU': 'js',
    'X-Okta-SDK-Version': SDK_VERSION
  };

  if (args.apiToken) {
    this.headers['Authorization'] = 'SSWS ' + args.apiToken;
  }

  this.resetState();

  log('OktaAuth created');
}

var proto = OktaAuth.prototype;

proto.get = function(url, broadcast, saveResponse) {
  url = isAbsoluteUrl(url) ? url : this.uri + url;
  return httpRequest(this, url, 'GET', undefined, !broadcast, !saveResponse);
};

proto.post = function(url, args, preventBroadcast, dontSaveResponse) {
  url = isAbsoluteUrl(url) ? url : this.uri + url;
  return httpRequest(this, url, 'POST', args, preventBroadcast, dontSaveResponse);
};


// NON-STANDARD METHODS

proto.subscribe = function(fn) {
  this.subscribedFn = fn;
};

proto.unsubscribe = function() {
  this.subscribedFn = undefined;
};

proto.getLastResponse = function() {
  return this.lastResponse;
};

proto.authStateExists = function() {
  // A local state token exists
  return !!(this.lastResponse && this.lastResponse.stateToken);
};

proto.authStateNeedsRefresh = function() {
  // No local state token, but we have a cookie state token
  return !(this.lastResponse && this.lastResponse.stateToken) && !!getCookie(STATE_TOKEN_COOKIE_NAME);
};

proto.refreshAuthState = function() {
  var stateToken = (this.lastResponse && this.lastResponse.stateToken) ||
    getCookie(STATE_TOKEN_COOKIE_NAME);
  return this.status({
    stateToken: stateToken
  });
};

// STANDARD METHODS

proto.status = function(args) {
  args = addStateToken(this, args);
  return this.post(this.uri + '/api/v1/authn', args);
};

proto.resetState = function() {
  setState(this, 'INITIAL');
};

function base64UrlToString(b64u) {
  var b64 = b64u.replace(/-/g, '+')
                .replace(/_/g, '/');
  switch (b64.length % 4) {
    case 0:
      break;
    case 2:
      b64 += '==';
      break;
    case 3:
      b64 += '=';
      break;
    default:
      throw 'Not a valid Base64Url';
  }
  var utf8 = atob(b64);
  try {
    return decodeURIComponent(escape(utf8));
  } catch (e) {
    return utf8;
  }
}

proto.decodeIdToken = function(idToken) {
  var jwt = idToken.split('.');
  var decodedToken;

  try {
    decodedToken = {
      header: JSON.parse(base64UrlToString(jwt[0])),
      payload: JSON.parse(base64UrlToString(jwt[1])),
      signature: jwt[2]
    };
  } catch(e) {
    throw new AuthSdkError('Malformed idToken');
  }

  return decodedToken;
};

proto.validateJwtClaims = function(jwt, iss, aud) {

  if (!jwt) {
    throw new Error('jwt argument is required');
  }

  if (!iss) {
    throw new Error('iss argument is required');
  }

  if (!aud) {
    throw new Error('aud argument is required');
  }

  var now = Math.round(new Date().getTime() / 1000);

  if (jwt.iss !== iss) {
    throw new Error('The JWT audience claim [' + jwt.iss +
      '] does not match [' + iss +']');
  }

  if (jwt.aud !== aud) {
    throw new Error('The JWT audience claim [' + jwt.aud +
      '] does not match [' + aud +']');
  }

  if (jwt.iat > jwt.exp) {
    throw new Error('The JWT was expired before it was issued');
  }

  if (now > jwt.exp) {
    throw new Error('The JWT is expired and no longer valid');
  }

  if (jwt.iat > now) {
    throw new Error('The JWT was issued before now');
  }
};


function getOAuthParams(options) {
  var params = {
    client_id: this.clientId,
    response_type: 'id_token',
    response_mode: isString(options.response_mode) ?
      options.response_mode :
      'okta_post_message',
    scope: options.scopes,
    redirect_uri: this.redirectUri,
    okta_sdk_sku: "js",
    okta_sdk_ver: SDK_VERSION
  };

  if (isString(options.state)) {
    params.state = options.state;
  }

  // Validate Scopes
  if (isString(options.scopes) && options.scopes.indexOf('openid') >= 0) {
    params.scope = scopes.split(' ');
  } else if (contains(params.scope, 'openid')) {
    params.scope = params.scope.join(' ');
  } else {
    throw new Error('openid scope must be specified in scopes argument');
  }

  // Select Display Options
  if (isString(options.idp)) {
    params.idp = options.idp;
    params.displayMode = 'popup';
  } else if (options.popup) {
    params.displayMode = 'popup';
  } else if (isString(options.sessionToken)) {
    params.prompt = 'none';
    params.sessionToken = options.sessionToken;
  } else if (options.prompt === false) {
    params.prompt = 'none';
  }

  return params;
}

function getOAuthFlow(params) {
  if (params.sessionToken || params.prompt === 'none') {
    return 'POST_MESSAGE';
  } else if (params.idp) {
    return 'POPUP'
  } else {
    return 'IMPLICIT'
  }
}

function postMessageCallback(state) {
  var self = this;
  var deferred = Q.defer();

  var responseHandler = function(event) {
    var claims;
    if(event.origin !== self.uri || !event.data) {
      //skip message
      return;
    }

    if (event.data.error || event.data.error_description) {
      return deferred.reject(new OAuthError(event.data.error, event.data.error_description));
    } else if (event.data.id_token) {
      if (event.data.state !== state) {
        return deferred.reject(new Error('OAuth implict flow response state does not match request state'));
      }
      claims = self.decodeIdToken(event.data.id_token).payload;
      try {
        self.validateJwtClaims(claims, self.uri, self.clientId);
      } catch(e) {
        return deferred.reject(e);
      }
      return deferred.resolve({
        id_token: event.data.id_token,
        claims: claims
      });
    } else {
      return deferred.reject(new Error('Unable to parse OAuth implict flow response'));
    }
  };

  window.addEventListener('message', responseHandler);

  return Q.timeout(deferred.promise, 120000).fin(function() {
    window.removeEventListener('message', responseHandler);
  });
}



/* jshint ignore:start */

/**
 * Compliment someone on their something.
 *
 * @param {Object} options
 * @param {String[]} [options.scopes] OAuth 2.0 scopes to request (openid must be specified)
 * @param {String} [options.idp] ID of an external IdP to use for user authententication
 * @param {String} [options.sessionToken] Bootstrap Session Token returned by the Okta Authentication API
 * @param {Boolean} [options.prompt] Determines whether to use an interactive or background flow
 * used
 */
proto.getIdToken = function(options) {
  var state = genRandom(64);;
  var windowEl, frameEl;
  var promise;

  var oauthParams = getOAuthParams.call(this, options);
  oauthParams.state = state;

  var requestUrl = this.authorizeUrl + queryParamSerialize(oauthParams);
  var flowType = getOAuthFlow(oauthParams);

  switch (flowType) {
    case 'POST_MESSAGE' :
      promise = postMessageCallback.call(this, state);
      frameEl = addFrame(FRAME_ID);
      frameEl.src = 'about:blank';
      loadFrame(requestUrl, FRAME_ID);
      return promise;
    case 'POPUP' :
      promise = postMessageCallback.call(this, state, windowEl);
      // todo: make width/height as options
      windowEl = window.open(requestUrl,
        isString(options.popupTitle) ?
          options.popupTitle :
          'External Identity Provider User Authentication',
        'toolbar=no, scrollbars=yes, resizable=yes, top=100, left=500, width=600, height=600');
      return promise.fin(function() {
        windowEl.close();
      });
    case 'IMPLICIT' :
      // save state to localStorage/sessionStorage
      window.location.replace(requestUrl);
      return promise;
  }
  return promise;
};
/* jshint ignore:end */


	function jqueryRequest(method, uri, args) {
	  var deferred = $.Deferred();
	  $.ajax({
	      type: method,
	      url: uri,
	      headers: args.headers,
	      data: JSON.stringify(args.data)
	    })
	    .then(function(data, textStatus, jqXHR) {
	      delete jqXHR.then;
	      deferred.resolve(jqXHR);
	    }, function(jqXHR) {
	      delete jqXHR.then;
	      deferred.reject(jqXHR);
	    });
	  return deferred;
	}
	OktaAuth.prototype.ajaxRequest = jqueryRequest;

    return OktaAuth;
});