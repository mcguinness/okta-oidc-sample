(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.OktaConfig = factory();
  }
}(this, function () {

    return {
      orgUrl: 'https://example.oktapreview.com',
      apiToken: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      authzIssuer: 'https://example.oktapreview.com/oauth2/aus8q4gst8vbUGzFp0h7',
      clientId: 'ANRZhyDh8HBFN5abN6Rg',
      idp: '0oa4ftg4vzKlWHHEJ0h7',
      scopes: ['openid', 'email', 'profile', 'phone', 'address', 'groups'],
      protectedScope: 'api:read'
    };

}));
