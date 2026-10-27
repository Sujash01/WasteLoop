/**
 * WasteLoop — API client (browser)
 *
 * Every page talks to the Node.js backend through this one small helper.
 * It is built only on the browser's native fetch() API — no Axios, no library.
 *
 * Demonstrates:  fetch() -> Promise -> async/await -> try/catch
 *
 * All functions throw a plain Error carrying `status`, `code` and `field` so a
 * page can highlight the exact input that the server rejected.
 */

var WasteLoopApi = (function () {
  function buildError(message, status, code, field) {
    var error = new Error(message);
    error.status = status || 0;
    error.code = code || 'REQUEST_FAILED';
    error.field = field || null;
    return error;
  }

  function getBaseUrl() {
    if (typeof window !== 'undefined' && window.WASTELOOP_API_BASE) {
      return window.WASTELOOP_API_BASE.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
      var port = window.location.port;
      var protocol = window.location.protocol;
      // If served via Live Server (port 5500, etc.) or static file preview,
      // route API calls to the Node.js backend port 3000
      if (protocol === 'file:' || (port && port !== '3000')) {
        return 'http://127.0.0.1:3000';
      }
    }
    return '';
  }

  /**
   * Core request. Resolves with parsed JSON, rejects with a useful Error.
   * @param {string} path e.g. '/api/pickups'
   * @param {object} options { method, body }
   */
  function request(path, options) {
    var settings = options || {};
    var init = {
      method: settings.method || 'GET',
      headers: { Accept: 'application/json' }
    };

    if (settings.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(settings.body);
    }

    var base = getBaseUrl();
    var fullUrl = (path.indexOf('http://') === 0 || path.indexOf('https://') === 0)
      ? path
      : base + path;

    return fetch(fullUrl, init)
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            // A non JSON body (for example an error page) still has to resolve.
            return {};
          })
          .then(function (data) {
            if (!response.ok || data.ok === false) {
              var detail = data && data.error ? data.error : {};
              var msg = detail.message;
              if (!msg) {
                if (response.status === 405) {
                  msg = 'Method Not Allowed (405). The server hosting this page cannot handle API POST requests. If you are using VS Code Live Server, please ensure the WasteLoop Node.js server is running ("npm start") and visit http://127.0.0.1:3000/.';
                } else if (response.status === 404) {
                  msg = 'API endpoint not found (404). Please ensure the WasteLoop Node.js server is running via "npm start".';
                } else {
                  msg = 'Request failed (' + response.status + ').';
                }
              }
              throw buildError(
                msg,
                response.status,
                detail.code,
                detail.field
              );
            }
            return data;
          });
      })
      .catch(function (error) {
        if (error && error.status) throw error;
        var targetServer = getBaseUrl() || (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://127.0.0.1:3000';
        throw buildError(
          'Cannot reach the WasteLoop server at ' + targetServer + '. Please make sure it is running (npm start).',
          0,
          'NETWORK_ERROR'
        );
      });
  }

  var api = {
    request: request,
    getBaseUrl: getBaseUrl,

    /* ---------- Pickups ---------- */
    createPickup: function (payload) {
      return request('/api/pickups', { method: 'POST', body: payload });
    },
    listPickups: function (query) {
      var suffix = query ? '?' + query : '';
      return request('/api/pickups' + suffix);
    },
    getPickup: function (id) {
      return request('/api/pickups/' + encodeURIComponent(id));
    },
    setPickupStatus: function (id, status) {
      return request('/api/pickups/' + encodeURIComponent(id) + '/status', {
        method: 'POST',
        body: { status: status }
      });
    },

    /* ---------- Grievances ---------- */
    createGrievance: function (payload) {
      return request('/api/grievances', { method: 'POST', body: payload });
    },
    getGrievance: function (id) {
      return request('/api/grievances/' + encodeURIComponent(id));
    },
    advanceGrievance: function (id, status) {
      return request('/api/grievances/' + encodeURIComponent(id) + '/status', {
        method: 'POST',
        body: status ? { status: status } : {}
      });
    },

    /* ---------- Impact / guide / certificates / meta ---------- */
    getImpact: function () {
      return request('/api/impact');
    },
    getWasteGuide: function (query) {
      return request('/api/waste-guide' + (query ? '?q=' + encodeURIComponent(query) : ''));
    },
    listCertificates: function () {
      return request('/api/certificates');
    },
    getCertificate: function (id) {
      return request('/api/certificates/' + encodeURIComponent(id));
    },
    createCertificate: function (pickupId) {
      return request('/api/certificates', { method: 'POST', body: { pickupId: pickupId } });
    },

    /* ---------- Reference data ---------- */
    getMeta: function () {
      return request('/api/meta');
    }
  };

  return api;
})();
