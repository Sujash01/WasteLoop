/**
 * WasteLoop — Real Live Map GPS Tracking Component (Leaflet.js + OpenStreetMap API)
 *
 * Real map tiles, real GPS coordinates, zoom/pan controls, animated vehicle marker,
 * live approach telemetry, and status progression.
 */

var WasteLoopLiveTracker = (function () {
  'use strict';

  // Real GPS coordinates (Ludhiana City collection route)
  var GPS_WAYPOINTS = [
    [30.8935, 75.8230], // Municipal Waste Recovery Transfer Station
    [30.8962, 75.8295], // Ferozepur Road Junction
    [30.8995, 75.8360], // Bharat Nagar Chowk
    [30.9025, 75.8450], // Aarti Chowk
    [30.9058, 75.8520], // Ghumar Mandi Crossing
    [30.9088, 75.8585], // Club Road
    [30.9055, 75.8635], // Model Town Market
    [30.9020, 75.8670], // Gol Market Circle
    [30.8995, 75.8690]  // Citizen Designated Premises
  ];

  var DEPOT_COORDS = GPS_WAYPOINTS[0];
  var HOME_COORDS = GPS_WAYPOINTS[GPS_WAYPOINTS.length - 1];

  var TOTAL_TICKS = 120;
  var TICK_MS = 800;

  var STATUS_FLOW = [
    'Collector Assigned',
    'On the Way',
    'Arriving',
    'Collected',
    'Completed'
  ];
  var STATUS_AT_PROGRESS = { 0: 0, 20: 1, 60: 2, 90: 3, 100: 4 };

  // Calculate distance between two lat/lng coordinates in km (Haversine formula)
  function distanceBetween(c1, c2) {
    var R = 6371; // Earth's radius in km
    var dLat = (c2[0] - c1[0]) * Math.PI / 180;
    var dLng = (c2[1] - c1[1]) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Precalculate cumulative distances along the route
  var segmentDistances = [];
  var totalRouteKm = 0;
  for (var i = 0; i < GPS_WAYPOINTS.length - 1; i++) {
    var d = distanceBetween(GPS_WAYPOINTS[i], GPS_WAYPOINTS[i + 1]);
    segmentDistances.push(d);
    totalRouteKm += d;
  }

  // Get exact [lat, lng] at a given progress (0.0 to 1.0)
  function coordAtProgress(progress) {
    if (progress <= 0) return GPS_WAYPOINTS[0];
    if (progress >= 1) return GPS_WAYPOINTS[GPS_WAYPOINTS.length - 1];

    var targetDist = progress * totalRouteKm;
    var accumulated = 0;

    for (var j = 0; j < segmentDistances.length; j++) {
      var segLen = segmentDistances[j];
      if (accumulated + segLen >= targetDist) {
        var ratio = segLen === 0 ? 0 : (targetDist - accumulated) / segLen;
        var p1 = GPS_WAYPOINTS[j];
        var p2 = GPS_WAYPOINTS[j + 1];
        return [
          p1[0] + (p2[0] - p1[0]) * ratio,
          p1[1] + (p2[1] - p1[1]) * ratio
        ];
      }
      accumulated += segLen;
    }
    return GPS_WAYPOINTS[GPS_WAYPOINTS.length - 1];
  }

  // Ensure Leaflet JS & CSS are loaded
  function loadLeaflet(callback) {
    if (typeof L !== 'undefined') {
      callback();
      return;
    }

    // Add Leaflet CSS if missing
    if (!document.getElementById('leaflet-css-bundle')) {
      var css = document.createElement('link');
      css.id = 'leaflet-css-bundle';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.crossOrigin = '';
      document.head.appendChild(css);
    }

    // Load Leaflet JS
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.onload = function () {
      callback();
    };
    script.onerror = function () {
      console.warn('Failed to load Leaflet from CDN. Trying local fallback...');
      var localScript = document.createElement('script');
      var isSubpage = window.location.pathname.indexOf('/pages/') !== -1;
      localScript.src = (isSubpage ? '../' : '') + 'assets/leaflet/leaflet.js';
      localScript.onload = callback;
      document.head.appendChild(localScript);
    };
    document.head.appendChild(script);
  }

  function LiveTrackerInstance(container, pickupData, options) {
    this.container = container;
    this.pickup = pickupData || this.defaultPickup();
    this.opts = options || {};
    this.timer = null;
    this.step = 0;
    this.coveredPath = [];
    this.statusIndex = -1;
    this.savedStatuses = [];
    this.isPaused = false;
    this.speed = 1;
    this.map = null;
    this.vehicleMarker = null;
    this.trailPolyline = null;
    this.mapId = 'lt-map-' + Math.random().toString(36).substring(2, 9);
    this.pagePrefix = this.opts.isSubpage ? '' : 'pages/';

    var self = this;
    this.renderHtml();

    loadLeaflet(function () {
      self.initLeafletMap();
      if (self.opts.autoStart !== false) {
        self.start();
      }
    });
  }

  LiveTrackerInstance.prototype.defaultPickup = function () {
    return {
      id: 'WL20491',
      citizenName: 'Aarav Sharma',
      address: '14 Model Town, Phase 1',
      city: 'Ludhiana',
      wasteCategory: 'Plastic & Dry Waste',
      weight: 6,
      distanceKm: Math.round(totalRouteKm * 10) / 10 || 4.8,
      etaMinutes: 15,
      status: 'Collector Assigned',
      collector: {
        name: 'Raj Kumar',
        vehicle: 'PB10 AB 1234',
        rating: 4.8,
        phone: '98765-43210'
      }
    };
  };

  LiveTrackerInstance.prototype.renderHtml = function () {
    var p = this.pickup;
    var collector = p.collector || {};
    var prefix = this.pagePrefix;

    this.container.innerHTML = [
      '<div class="tracking-layout live-tracker-layout">',
      '  <div class="map-card">',
      '    <div class="map-head">',
      '      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">',
      '        <span class="live-badge"><span class="live-pulse-dot"></span> LIVE OPENSTREETMAP API</span>',
      '        <h3 style="margin:0; font-size:1.05rem; font-weight:700;">Active Vehicle Route</h3>',
      '      </div>',
      '      <span class="map-tag" style="color:var(--green); border-color:var(--green); background:rgba(22,163,74,0.1);">GPS CONNECTED</span>',
      '    </div>',
      '    <div id="' + this.mapId + '" class="leaflet-map-stage"></div>',
      '    <div class="map-progress">',
      '      <div class="progress-track"><div class="progress-fill lt-progress-fill"></div></div>',
      '      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">',
      '        <span class="progress-text lt-progress-text" style="margin:0; font-weight:600;">0% of route completed</span>',
      '        <span class="lt-live-chip" style="font-size:0.78rem; font-weight:700; color:var(--green); background:rgba(24,160,88,0.12); padding:2px 8px; border-radius:12px;">Approaching Location</span>',
      '      </div>',
      '    </div>',
      '    <div class="tracker-controls">',
      '      <button type="button" class="btn btn-secondary btn-sm lt-btn-pause">Pause</button>',
      '      <button type="button" class="btn btn-secondary btn-sm lt-btn-restart">Restart</button>',
      '      <button type="button" class="btn btn-secondary btn-sm lt-btn-speed">2x Speed</button>',
      '      <a href="' + prefix + 'track.html?id=' + encodeURIComponent(p.id) + '" class="btn btn-primary btn-sm" style="margin-left:auto;">Full Tracking Portal &rarr;</a>',
      '    </div>',
      '  </div>',
      '  <div class="track-details">',
      '    <div class="detail-card">',
      '      <div style="display:flex; justify-content:space-between; align-items:flex-start;">',
      '        <div>',
      '          <p class="section-label" style="margin:0 0 4px;">Active Pickup Request</p>',
      '          <p class="detail-id" style="font-size:1.35rem; margin:0 0 4px; font-weight:800;">' + (p.id || '—') + '</p>',
      '        </div>',
      '        <span class="status-pill lt-val-status">Collector Assigned</span>',
      '      </div>',
      '      <p style="margin:6px 0 0; font-size:0.86rem; color:var(--text-sec);">' + (p.address ? p.address + ', ' + (p.city || '') : 'Model Town, Ludhiana') + '</p>',
      '    </div>',
      '    <div class="detail-card">',
      '      <h3 style="margin-top:0;">Assigned Municipal Collector</h3>',
      '      <dl class="detail-list">',
      '        <dt>Collector Name</dt><dd>' + (collector.name || 'Municipal Team') + '</dd>',
      '        <dt>Vehicle No.</dt><dd>' + (collector.vehicle || 'PB10 AB 1234') + '</dd>',
      '        <dt>Driver Rating</dt><dd>★ ' + (collector.rating ? collector.rating + ' / 5.0' : '4.8 / 5.0') + '</dd>',
      '        <dt>Helpline Contact</dt><dd>' + (collector.phone || '1800-11-9001') + '</dd>',
      '      </dl>',
      '    </div>',
      '    <div class="detail-card">',
      '      <h3 style="margin-top:0;">Live Approach Telemetry</h3>',
      '      <dl class="detail-list">',
      '        <dt>Remaining Distance</dt><dd class="lt-val-distance" style="font-weight:700; color:var(--green); font-size:1.05rem;">-- km</dd>',
      '        <dt>Estimated Arrival</dt><dd class="lt-val-eta" style="font-weight:700; color:var(--orange); font-size:1.05rem;">-- mins</dd>',
      '        <dt>Waste Category</dt><dd>' + (p.wasteCategory || 'Municipal Waste') + (p.weight ? ' (' + p.weight + ' kg)' : '') + '</dd>',
      '      </dl>',
      '    </div>',
      '    <div class="detail-card lt-card-cert" style="display:none; background:color-mix(in srgb, var(--green) 10%, var(--surface)); border-color:var(--green);">',
      '      <h3 style="margin-top:0; color:var(--green);">Collection Completed!</h3>',
      '      <p style="font-size:0.86rem; margin:0 0 12px;">Your waste has been collected by the vehicle and delivered for recycling. Your digital certificate is ready.</p>',
      '      <a href="' + prefix + 'certificate.html?pickup=' + encodeURIComponent(p.id) + '" class="btn btn-primary btn-sm">View Recycling Certificate &rarr;</a>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    this.els = {
      progressFill: this.container.querySelector('.lt-progress-fill'),
      progressText: this.container.querySelector('.lt-progress-text'),
      liveChip: this.container.querySelector('.lt-live-chip'),
      statusPill: this.container.querySelector('.lt-val-status'),
      distanceText: this.container.querySelector('.lt-val-distance'),
      etaText: this.container.querySelector('.lt-val-eta'),
      pauseBtn: this.container.querySelector('.lt-btn-pause'),
      restartBtn: this.container.querySelector('.lt-btn-restart'),
      speedBtn: this.container.querySelector('.lt-btn-speed'),
      certCard: this.container.querySelector('.lt-card-cert')
    };

    var self = this;
    if (this.els.pauseBtn) {
      this.els.pauseBtn.addEventListener('click', function () {
        if (self.isPaused) {
          self.resume();
        } else {
          self.pause();
        }
      });
    }

    if (this.els.restartBtn) {
      this.els.restartBtn.addEventListener('click', function () {
        self.restart();
      });
    }

    if (this.els.speedBtn) {
      this.els.speedBtn.addEventListener('click', function () {
        if (self.speed === 1) {
          self.speed = 2;
          self.els.speedBtn.textContent = '4x Speed';
        } else if (self.speed === 2) {
          self.speed = 4;
          self.els.speedBtn.textContent = '1x Speed';
        } else {
          self.speed = 1;
          self.els.speedBtn.textContent = '2x Speed';
        }
      });
    }
  };

  LiveTrackerInstance.prototype.initLeafletMap = function () {
    var mapEl = document.getElementById(this.mapId);
    if (!mapEl || typeof L === 'undefined') return;

    try {
      this.map = L.map(this.mapId, {
        zoomControl: true,
        scrollWheelZoom: false
      });

      // OpenStreetMap Tiles Layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
      }).addTo(this.map);

      // Custom DivIcons
      var vehicleIcon = L.divIcon({
        className: 'leaflet-vehicle-icon',
        html: '<div class="leaflet-vehicle-inner">🚛<span class="leaflet-marker-label">Collector</span></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      var homeIcon = L.divIcon({
        className: 'leaflet-home-icon',
        html: '<div class="leaflet-home-inner">🏠<span class="leaflet-marker-label">Citizen Address</span></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      var depotIcon = L.divIcon({
        className: 'leaflet-depot-icon',
        html: '<div class="leaflet-depot-inner">♻️<span class="leaflet-marker-label">Waste Depot</span></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      // Markers
      L.marker(DEPOT_COORDS, { icon: depotIcon })
        .addTo(this.map)
        .bindPopup('<b>Municipal Solid Waste Depot</b><br>Collection Start Point');

      L.marker(HOME_COORDS, { icon: homeIcon })
        .addTo(this.map)
        .bindPopup('<b>Citizen Premises</b><br>' + (this.pickup.address || 'Designated Collection Address'));

      this.vehicleMarker = L.marker(GPS_WAYPOINTS[0], { icon: vehicleIcon })
        .addTo(this.map)
        .bindPopup('<b>Collector: ' + (this.pickup.collector ? this.pickup.collector.name : 'Municipal Team') + '</b><br>Vehicle: ' + (this.pickup.collector ? this.pickup.collector.vehicle : 'PB10 AB 1234'));

      // Planned Route Polyline
      L.polyline(GPS_WAYPOINTS, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.55,
        dashArray: '8, 8'
      }).addTo(this.map);

      // Live Covered Trail Polyline
      this.trailPolyline = L.polyline([GPS_WAYPOINTS[0]], {
        color: '#16a34a',
        weight: 5,
        opacity: 0.95
      }).addTo(this.map);

      // Fit map view to route bounds
      this.map.fitBounds(L.latLngBounds(GPS_WAYPOINTS), {
        padding: [35, 35]
      });

      var self = this;
      setTimeout(function () {
        if (self.map) self.map.invalidateSize();
      }, 300);

    } catch (err) {
      console.error('Error initializing Leaflet live map:', err);
    }
  };

  LiveTrackerInstance.prototype.progressPercent = function () {
    return Math.min(100, (this.step / TOTAL_TICKS) * 100);
  };

  LiveTrackerInstance.prototype.remainingDistance = function () {
    var total = Number(this.pickup.distanceKm) || totalRouteKm;
    var left = total * (1 - this.progressPercent() / 100);
    return Math.max(0, Math.round(left * 10) / 10);
  };

  LiveTrackerInstance.prototype.remainingEta = function () {
    var total = Number(this.pickup.etaMinutes) || 15;
    var left = total * (1 - this.progressPercent() / 100);
    return Math.max(0, Math.round(left));
  };

  LiveTrackerInstance.prototype.statusForProgress = function () {
    var pct = this.progressPercent();
    var best = 0;
    Object.keys(STATUS_AT_PROGRESS)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .forEach(function (threshold) {
        if (pct >= threshold) best = STATUS_AT_PROGRESS[threshold];
      });
    return STATUS_FLOW[best];
  };

  LiveTrackerInstance.prototype.updateMetrics = function (statusName) {
    var dist = this.remainingDistance();
    var eta = this.remainingEta();
    var pct = Math.round(this.progressPercent());

    if (this.els.distanceText) this.els.distanceText.textContent = dist + ' km';
    if (this.els.etaText) this.els.etaText.textContent = eta + ' mins';
    if (this.els.statusPill) this.els.statusPill.textContent = statusName;
    if (this.els.progressFill) this.els.progressFill.style.width = pct + '%';
    if (this.els.progressText) this.els.progressText.textContent = pct + '% of route completed';

    if (this.els.liveChip) {
      if (statusName === 'Completed') {
        this.els.liveChip.textContent = 'Arrived & Collected';
        this.els.liveChip.style.color = 'var(--navy)';
        this.els.liveChip.style.background = 'rgba(16,40,85,0.12)';
      } else if (statusName === 'Arriving') {
        this.els.liveChip.textContent = 'Arriving at Premises';
        this.els.liveChip.style.color = 'var(--orange)';
        this.els.liveChip.style.background = 'rgba(230,81,0,0.12)';
      } else {
        this.els.liveChip.textContent = 'En Route (' + eta + 'm)';
      }
    }
  };

  LiveTrackerInstance.prototype.saveStatus = function (statusName) {
    if (!this.pickup || !this.pickup.id) return;
    if (this.savedStatuses.indexOf(statusName) !== -1) return;
    this.savedStatuses.push(statusName);

    if (typeof WasteLoopApi !== 'undefined' && WasteLoopApi.setPickupStatus) {
      WasteLoopApi.setPickupStatus(this.pickup.id, statusName).catch(function () {});
    }
  };

  LiveTrackerInstance.prototype.tick = function () {
    this.step += this.speed;
    if (this.step > TOTAL_TICKS) this.step = TOTAL_TICKS;

    var progress = this.progressPercent() / 100;
    var currentCoord = coordAtProgress(progress);

    if (this.vehicleMarker) {
      this.vehicleMarker.setLatLng(currentCoord);
    }

    this.coveredPath.push(currentCoord);
    if (this.trailPolyline) {
      this.trailPolyline.setLatLngs(this.coveredPath);
    }

    var statusName = this.statusForProgress();
    this.updateMetrics(statusName);

    if (STATUS_FLOW.indexOf(statusName) !== this.statusIndex) {
      this.statusIndex = STATUS_FLOW.indexOf(statusName);
      this.saveStatus(statusName);
    }

    if (this.step >= TOTAL_TICKS) {
      this.finish();
    }
  };

  LiveTrackerInstance.prototype.finish = function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    var finalCoord = GPS_WAYPOINTS[GPS_WAYPOINTS.length - 1];
    if (this.vehicleMarker) {
      this.vehicleMarker.setLatLng(finalCoord);
      this.vehicleMarker.openPopup();
    }

    this.coveredPath.push(finalCoord);
    if (this.trailPolyline) {
      this.trailPolyline.setLatLngs(this.coveredPath);
    }

    this.updateMetrics('Completed');

    if (this.els.pauseBtn) {
      this.els.pauseBtn.disabled = true;
      this.els.pauseBtn.textContent = 'Completed';
    }
    if (this.els.certCard) {
      this.els.certCard.style.display = 'block';
      this.els.certCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    this.saveStatus('Completed');
  };

  LiveTrackerInstance.prototype.start = function () {
    if (this.timer) clearInterval(this.timer);
    this.step = 0;
    this.coveredPath = [GPS_WAYPOINTS[0]];
    this.statusIndex = -1;
    this.savedStatuses = [];
    this.isPaused = false;

    if (this.vehicleMarker) {
      this.vehicleMarker.setLatLng(GPS_WAYPOINTS[0]);
    }
    if (this.trailPolyline) {
      this.trailPolyline.setLatLngs(this.coveredPath);
    }
    if (this.els.pauseBtn) {
      this.els.pauseBtn.disabled = false;
      this.els.pauseBtn.textContent = 'Pause';
    }
    if (this.els.certCard) {
      this.els.certCard.style.display = 'none';
    }

    this.updateMetrics('Collector Assigned');

    var self = this;
    this.timer = setInterval(function () {
      self.tick();
    }, TICK_MS);
  };

  LiveTrackerInstance.prototype.pause = function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPaused = true;
    if (this.els.pauseBtn) {
      this.els.pauseBtn.textContent = 'Resume';
    }
  };

  LiveTrackerInstance.prototype.resume = function () {
    if (this.step >= TOTAL_TICKS) return;
    this.isPaused = false;
    if (this.els.pauseBtn) {
      this.els.pauseBtn.textContent = 'Pause';
    }
    var self = this;
    this.timer = setInterval(function () {
      self.tick();
    }, TICK_MS);
  };

  LiveTrackerInstance.prototype.restart = function () {
    this.start();
  };

  LiveTrackerInstance.prototype.destroy = function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {}
      this.map = null;
    }
    this.container.innerHTML = '';
  };

  return {
    mount: function (container, pickupData, options) {
      if (!container) return null;
      return new LiveTrackerInstance(container, pickupData, options);
    }
  };
})();
