requirejs.config({
    "baseUrl": "js",
    "paths": {
      "jquery": "jquery-2.1.4.min",
      "okta-auth-sdk": "okta-auth-sdk-1.0.0.min"
    }
});

define(["jquery", "okta-auth-sdk"], function($, OktaAuth) {

  var idp = '0oa5kecjfwuF4HQ4w0h7';
  var client = new OktaAuth({
    url: "https://example.oktapreview.com",
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

  var displayError = function(msg) {
    $('div.error').remove();
    $('div.login-box').append('<div class="error"><p>'+ msg + '</p></div>');
  }

  $(document).ready(function() {
    $('#btn-sign-in').click(function() {
      resetDisplay();
      client.signIn({
        username: $('#username').val(),
        password: $('#password').val()
      }).then(function(tx) {
        switch(tx.status) {
          case 'SUCCESS':
            client.idToken.authorize({
              scopes: ['openid', 'email', 'profile', 'phone'],
              sessionToken: tx.sessionToken
            })
              .then(function(res) {
                console.log('id_token: %s', res.idToken);
                displayClaims(res.claims);
                localStorage.setItem('id_token', res.idToken);
              })
              .fail(function(err) {
                console.log(err);
                displayError(err.message);
              })
            break;
          default:
            throw 'We cannot handle the ' + tx.status + ' status';
        }

      }).fail(function(err) {
        console.log(err);
        var message = err.errorCauses.length > 0 ? err.errorCauses[0].errorSummary : err.message;
        displayError(message);
      });
    });

    $('#btn-idp').click(function() {
      resetDisplay();
      client.idToken.authorize({
        scopes: ['openid', 'email', 'profile', 'phone'],
        prompt: false,
        idp: idp
      })
        .then(function(res) {
          console.log('id_token: %s', res.idToken);
          displayClaims(res.claims);
          localStorage.setItem('id_token', res.idToken);
        })
        .fail(function(err) {
          console.log(err);
          displayError(err.message);
        })
    });


    $('#btn-refresh').click(function() {
      resetDisplay();
      var idToken = localStorage.getItem('id_token');
      if (!idToken) {
        return displayError('You must first sign-in before you can refresh a token!');
      }
      client.idToken.refresh(idToken)
        .then(function(res) {
          console.log('id_token: %s', idToken);
          displayClaims(res.claims);
        })
        .fail(function(err) {
          console.log(err);
          displayError(err.message);
          localStorage.setItem('id_token', null);
        })
    });
  });
});
