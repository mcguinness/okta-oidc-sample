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
      clientId: 'ANRZhyDh8HBFN5abN6Rg',
      idp: '0oa5kecjfwuF4HQ4w0h7'
    };

}));
