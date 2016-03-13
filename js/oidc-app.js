requirejs.config({
    "baseUrl": "js",
    "paths": {
      "jquery": "jquery-2.1.4.min",
      "okta-auth-sdk": "OktaAuthRequireJquery"
    }
});

define(["jquery", "okta-auth-sdk"], function($, OktaAuth) {

  var idp = '0oa5kecjfwuF4HQ4w0h7';
  var client = new OktaAuth({
    uri: "https://example.oktapreview.com",
    clientId: 'ANRZhyDh8HBFN5abN6Rg',
    redirectUri: window.location.href
  });

  var resetDisplay = function() {
    $('div.error').remove();
    $('#claims').empty();
  };

  var displayClaims = function(claims) {
    $('#claims').append('<pre><code class="json">' +
      JSON.stringify(claims, null, '  ') + '</code></pre>');
    $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
    });
  };

  $(document).ready(function() {
    $('#btn-sign-in').click(function() {
      resetDisplay();
      client.current.primaryAuth({
        username: $('#username').val(),
        password: $('#password').val()
      }).then(function(res) {
        client.getIdToken({
          scopes: ['openid', 'email', 'profile', 'phone'],
          sessionToken: res.sessionToken
        })
          .then(function(res) {
            console.log('id_token: %s', res.id_token);
            displayClaims(res.claims);
          })
          .fail(function(err) {
            console.log(err);
            $('div.login-box').append('<div class="error"><p>'+ err.message + '</p></div>');
          })
      }).fail(function(err) {
        console.log(err);
        var message = err.errorCauses.length > 0 ? err.errorCauses[0].errorSummary : err.message;
        $('div.login-box').append('<div class="error"><p>'+ message + '</p></div>');
      });
    });

    $('#btn-idp').click(function() {
      resetDisplay();
      client.getIdToken({
        scopes: ['openid', 'email', 'profile', 'phone'],
        prompt: false,
        idp: idp
      })
        .then(function(res) {
          console.log('id_token: %s', res.id_token);
          displayClaims(res.claims);
        })
        .fail(function(err) {
          console.log(err);
          $('div.login-box').append('<div class="error"><p>'+ err.message + '</p></div>');
        })
    });


    $('#btn-refresh').click(function() {
      resetDisplay();
      client.getIdToken({
        scopes: ['openid', 'email', 'profile', 'phone'],
        prompt: false
      })
        .then(function(res) {
          console.log('id_token: %s', res.id_token);
          displayClaims(res.claims);
        })
        .fail(function(err) {
          console.log(err);
          $('div.login-box').append('<div class="error"><p>'+ err.message + '</p></div>');
        })
    });
  });
});
