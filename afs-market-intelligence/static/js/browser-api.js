(function () {
  'use strict';

  function apiBase() {
    if (typeof window.__AFS_MARKET_API_BASE__ === 'string' && window.__AFS_MARKET_API_BASE__) {
      return window.__AFS_MARKET_API_BASE__.replace(/\/$/, '');
    }
    var basePath = '';
    try {
      var m = window.location.pathname.match(/^(\/[^/]+)\/afs-market-intelligence/);
      if (m) basePath = m[1];
    } catch (e) { /* ignore */ }
    return (basePath + '/afs-market-api').replace(/\/+/g, '/');
  }

  function apiPath(path) {
    var p = path.indexOf('/') === 0 ? path : '/' + path;
    var base = apiBase();
    if (/^https?:\/\//i.test(base)) {
      return p.indexOf('/api/') === 0 ? p : '/api' + p;
    }
    return p;
  }

  async function apiFetch(path, options) {
    var url = apiBase() + apiPath(path);
    const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {}));
    return res.json();
  }

  window.AFSMarketAPI = {
    base: apiBase,
    get: function (path) { return apiFetch(path); },
    post: function (path, body) {
      return apiFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });
    },
  };
})();
