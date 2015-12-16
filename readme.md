# Overview

Sample Single-Page Web App (SPA) for Okta OpenID Connect

You can find the main javascript code in `/js/app.js` and html in `oidc.html`

## Sample Scenarios

This sample app demonstrates the following scenarios:

- Sign-In: Authenticates user with [name/password](http://developer.okta.com/docs/api/resources/authn.html#primary-authentication-with-public-application) and exchanges a [sessionToken](http://developer.okta.com/docs/api/resources/authn.html#session-token) for an id_token (JWT)
- Refresh: Attempts to use an existing session to obtain an id_token (JWT)

## Setup

> This document assumes you host this app on `http://localhost:8080/`

1. Grant the app [CORS access](http://developer.okta.com/docs/api/getting_started/enabling_cors.html) in your Okta organization

2. Register OAuth 2.0 Client

> Requires [API Token](http://developer.okta.com/docs/api/getting_started/getting_a_token.html)

```sh
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "Authorization: SSWS XXXXXXXXXXXXXXXXXXXXXXXX" -H "Cache-Control: no-cache" -d '  {
    "client_name": "Sample OpenID Connnect Web App",
    "client_uri": "http://localhost:8080/",
    "logo_uri": null,
    "redirect_uris": [
      "http://localhost:8080/oidc.html"
    ],
    "response_types": [
      "id_token"
    ],
    "grant_types": [
      "implicit"
    ],
    "token_endpoint_auth_method": "none"
  }' 'https://org.oktapreview.com/oauth2/v1/clients'
```

```json
{
    "id": "pcac498beo7FGhJO80g4",
    "created": "2015-12-16T06:19:21.000Z",
    "lastUpdated": "2015-12-16T06:19:21.000Z",
    "client_name": "Sample OpenID Connnect Web App",
    "client_uri": "http://localhost:8080/",
    "logo_uri": null,
    "redirect_uris": [
        "http://localhost:8080/oidc.html"
    ],
    "response_types": [
        "id_token"
    ],
    "grant_types": [
        "implicit"
    ],
    "token_endpoint_auth_method": "none",
    "client_id": "IaBv2P521nkEC8IzaL45",
    "client_id_issued_at": 1450246761
}
```

3. Update `/js/app.js` with `client_id` returned from OAuth 2.0 Registration and your Okta organization url

```
  var client = new OktaAuth({
    uri: "https://org.oktapreview.com",
    clientId: 'IaBv2P521nkEC8IzaL45',
    redirectUri: window.location.href
  });
```

> This example assumes that the `redirectUri` is the url that the page is hosted on and matches the same value as the OAuth 2.0 Client Registration `redirect_uris`

4. Start Web Server (e.g. http://localhost:8080/oidc.html")

Quick and easy way to self-host is by installing [node.js](https://nodejs.org/en/download/) and the [http-server](https://www.npmjs.com/package/http-server) package which is a simple command-line web server

```
karl@guinness: ~/src/okta-oidc-sample
$ http-server
Starting up http-server, serving ./ on: http://0.0.0.0:8080
Hit CTRL-C to stop the server
```

5. Visit http://localhost:8080/oidc.html to launch the sample app
