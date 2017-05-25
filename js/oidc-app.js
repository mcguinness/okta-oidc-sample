requirejs.config({
    "baseUrl": "js",
    "paths": {
      "jquery": "https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min",
      "okta-auth-sdk": "https://ok1static.oktacdn.com/assets/js/sdk/okta-auth-js/1.5.0/OktaAuth.min",
      "okta-config": "config"
    }
});

var ID_TOKEN_KEY = 'id_token';
var ACCESS_TOKEN_KEY = 'access_token';
var OIDC_MODE = 'oidc';
var OAUTH_MODE = 'oauth';

define(["jquery", "okta-auth-sdk", "okta-config"], function($, OktaAuth, OktaConfig) {

  console.log('Okta Configuration: %o', OktaConfig);

  var client = new OktaAuth({
    url: OktaConfig.orgUrl,
    clientId: OktaConfig.clientId,
    redirectUri: window.location.href
  });

  client.tokenManager.on('refreshed', function(key, token) {
    if (key === ID_TOKEN_KEY) {
      console.log('refreshed a new id_token');
      displayClaims(token.claims);
    } else if (key === ACCESS_TOKEN_KEY) {
      console.log('refreshed a new access_token');
    }
  });

  var useAuthorizationSever = function() {
    return $('input[name=mode]:checked', '#radio-mode').val() === OAUTH_MODE;
  }

  var resetDisplay = function() {
    $('div.error').remove();
    $('#claims').empty();
    $('#api-resources').empty();
  };

  var displayClaims = function(claims) {
    $('#claims').append('<pre><code class="json">' +
      JSON.stringify(claims, null, '  ') + '</code></pre>');
    $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
    });
  };

  var displayError = function(msg) {
    $('div.error').remove();
    $('div.login-box').append('<div class="error"><p>'+ msg + '</p></div>');
  }

  $(document).ready(function() {

    $('input[name=mode]', '#radio-mode').change(function() {
        $('#btn-api-request').prop('disabled', this.value == OIDC_MODE);
    });

    $('#btn-sign-in').click(function() {
      resetDisplay();

      client.signIn({
        username: $('#username').val(),
        password: $('#password').val()
      }).then(function(tx) {
        switch(tx.status) {
          case 'SUCCESS':
            var scopes = OktaConfig.scopes.slice(0);
            if (useAuthorizationSever()) {
              scopes.push(OktaConfig.protectedScope);
            }
            client.token.getWithoutPrompt({
              scopes: scopes,
              responseType: ['id_token', 'token'],
              sessionToken: tx.sessionToken
            }, {
              issuer: useAuthorizationSever() ?
                OktaConfig.authzIssuer :
                OktaConfig.orgUrl
            })
              .then(function(res) {
                console.log('tokens: %O', res);
                displayClaims(res[0].claims);
                client.tokenManager.add(ID_TOKEN_KEY, res[0]);
                client.tokenManager.add(ACCESS_TOKEN_KEY, res[1]);
              })
              .fail(function(err) {
                console.log(err);
                displayError(err.message);
              })
            break;
          default:
            throw 'Support for ' + tx.status + ' status is not implemented!';
        }

      }).fail(function(err) {
        console.log(err);
        var message = err.errorCauses.length > 0 ? err.errorCauses[0].errorSummary : err.message;
        displayError(message);
      });
    });

    $('#btn-idp').click(function() {
      resetDisplay();
      var scopes = OktaConfig.scopes.slice(0);
      if (useAuthorizationSever()) {
        scopes.push(OktaConfig.protectedScope);
      }

      client.token.getToken({
        scopes: scopes,
        responseType: ['id_token', 'token'],
        idp: OktaConfig.idp
      }, {
        issuer: useAuthorizationSever() ?
          OktaConfig.authzIssuer :
          OktaConfig.orgUrl
      })
        .then(function(res) {
          console.log('tokens: %O', res);
          displayClaims(res[0].claims);
          client.tokenManager.add(ID_TOKEN_KEY, res[0]);
          client.tokenManager.add(ACCESS_TOKEN_KEY, res[1]);
        })
        .fail(function(err) {
          console.log(err);
          displayError(err.message);
        });
    });

    $('#btn-refresh').click(function() {
      resetDisplay();

      client.tokenManager.refresh(ID_TOKEN_KEY);
      client.tokenManager.refresh(ACCESS_TOKEN_KEY);
    });


    $('#btn-api-request').click(function() {
      resetDisplay();
      var token = client.tokenManager.get(ACCESS_TOKEN_KEY);
      if (!token) {
        return displayError('You must first sign-in before you can request a protected resource!');
      }
      $.ajax({
          url : '/protected',
          headers: {
            Authorization: 'Bearer ' + token.accessToken
          },
          processData : false,
      }).done(function(b64data){
        $('#api-resources').append('<img src="data:image/png;base64,' + b64data + '">');
      }).fail(function(jqXHR, textStatus) {
        var msg = 'Unable to fetch protected resource';
        msg += '<br>' + jqXHR.status + ' ' + jqXHR.responseText;
        if (jqXHR.status === 401) {
          msg += '<br>Your token may be expired'
        }
        displayError(msg);
      });
    });

    $('#btn-sign-out').click(function() {
      resetDisplay();

      client.tokenManager.clear();
      client.session.close();
    });

  });
});
