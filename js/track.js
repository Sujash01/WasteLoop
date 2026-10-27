/**
 * WasteLoop — Feature 1: Live Garbage Collector Tracking (Leaflet.js + OpenStreetMap API)
 *
 * Real map tiles, real GPS coordinates, zoom/pan controls, animated vehicle marker,
 * live approach telemetry, and status progression.
 */

(function () {
  'use strict';

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

  var TICK_MS = 850;
  var TOTAL_STEPS = 120;

  var STATUS_FLOW = [
    'Collector Assigned',
    'On the Way',
    'Arriving',
    'Collected',
    'Completed'
  ];
  var STATUS_AT_PROGRESS = { 0: 0, 25: 1, 65: 2, 92: 3, 100: 4 };

  var els = {
    form: document.getElementById('track-form'),
    input: document.getElementById('request-id'),
    message: document.getElementById('track-message'),
    lookup: document.getElementById('track-lookup'),
    panel: document.getElementById('track-panel'),
    map: document.getElementById('track-map'),
    id: document.getElementById('detail-id'),
    status: document.getElementById('detail-status'),
    collector: document.getElementById('detail-collector'),
    vehicleNo: document.getElementById('detail-vehicle'),
    rating: document.getElementById('detail-rating'),
    distance: document.getElementById('detail-distance'),
    eta: document.getElementById('detail-eta'),
    weight: document.getElementById('detail-weight'),
    pickupDate: document.getElementById('detail-date'),
    steps: document.querySelectorAll('#track-steps li'),
    progressBar: document.getElementById('track-progress-bar'),
    progressText: document.getElementById('track-progress-text'),
    certificateBox: document.getElementById('certificate-actions'),
    hint: document.getElementById('track-hint')
  };

  var state = {
    pickup: null,
    timer: null,
    step: 0,
    coveredPath: [],
    statusIndex: -1,
    savedStatuses: [],
    leafletMap: null,
    vehicleMarker: null,
    trailPolyline: null
  };

  function round(value, places) {
    var factor = Math.pow(10, places || 1);
    return Math.round(value * factor) / factor;
  }

  function distanceBetween(c1, c2) {
    var R = 6371;
    var dLat = (c2[0] - c1[0]) * Math.PI / 180;
    var dLng = (c2[1] - c1[1]) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  var segmentDistances = [];
  var totalRouteKm = 0;
  for (var i = 0; i < GPS_WAYPOINTS.length - 1; i++) {
    var d = distanceBetween(GPS_WAYPOINTS[i], GPS_WAYPOINTS[i + 1]);
    segmentDistances.push(d);
    totalRouteKm += d;
  }

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

  function progressPercent() {
    return Math.min(100, (state.step / TOTAL_STEPS) * 100);
  }

  function remainingDistance() {
    var total = Number(state.pickup ? state.pickup.distanceKm : 0) || totalRouteKm;
    return round(total * (1 - progressPercent() / 100), 1);
  }

  function remainingEta() {
    var total = Number(state.pickup ? state.pickup.etaMinutes : 0) || 16;
    return Math.max(0, Math.round(total * (1 - progressPercent() / 100)));
  }

  function renderTimeline(statusName) {
    var currentIndex = STATUS_FLOW.indexOf(statusName);
    Array.prototype.forEach.call(els.steps, function (step, index) {
      step.classList.toggle('completed', index < currentIndex);
      step.classList.toggle('active', index === currentIndex);
    });
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function renderLiveValues(statusName) {
    setText(els.distance, remainingDistance() + ' km');
    setText(els.eta, remainingEta() + ' minutes');
    setText(els.status, statusName);

    var percent = Math.round(progressPercent());
    if (els.progressBar) els.progressBar.style.width = percent + '%';
    if (els.progressText) els.progressText.textContent = percent + '% of journey completed';
  }

  function statusForProgress() {
    var percent = progressPercent();
    var best = 0;
    Object.keys(STATUS_AT_PROGRESS)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .forEach(function (threshold) {
        if (percent >= threshold) best = STATUS_AT_PROGRESS[threshold];
      });
    return STATUS_FLOW[best];
  }

  function renderDetails() {
    var pickup = state.pickup;
    if (!pickup) return;

    var collector = pickup.collector || {};

    setText(els.id, pickup.id);
    setText(els.collector, collector.name || 'Being allotted');
    setText(els.vehicleNo, collector.vehicle || '—');
    setText(els.rating, collector.rating ? collector.rating + ' / 5.0' : '—');
    setText(els.weight, pickup.weight + ' kg · ' + pickup.wasteCategory);
    setText(els.pickupDate, WasteLoopDates.formatLongDate(pickup.pickupDate));

    var addrEl = document.getElementById('detail-address');
    if (addrEl && pickup.address) {
      setText(addrEl, pickup.address);
    }
  }

  function saveStatus(statusName) {
    if (!state.pickup) return Promise.resolve(null);
    if (state.savedStatuses.indexOf(statusName) !== -1) return Promise.resolve(null);
    state.savedStatuses.push(statusName);

    return WasteLoopApi.setPickupStatus(state.pickup.id, statusName)
      .then(function (data) {
        state.pickup = data.pickup;
        return data.pickup;
      })
      .catch(function (error) {
        state.savedStatuses.pop();
        console.warn('Could not save status "' + statusName + '":', error.message);
        return null;
      });
  }

  function renderCertificateAction() {
    if (!els.certificateBox) return;
    els.certificateBox.innerHTML = '';

    var pickup = state.pickup;
    var completed = pickup && pickup.status === 'Completed';

    if (!completed) {
      var note = document.createElement('p');
      note.className = 'notice-text';
      note.textContent =
        'The digital recycling certificate is unlocked when this pickup reaches the Completed status.';
      els.certificateBox.appendChild(note);
      return;
    }

    if (pickup.certificateId) {
      var link = document.createElement('a');
      link.className = 'btn btn-primary';
      link.href = 'certificate.html?id=' + encodeURIComponent(pickup.certificateId);
      link.textContent = 'View Recycling Certificate (' + pickup.certificateId + ')';
      els.certificateBox.appendChild(link);
      return;
    }

    var generate = document.createElement('button');
    generate.className = 'btn btn-primary';
    generate.type = 'button';
    generate.textContent = 'Generate Certificate';

    generate.addEventListener('click', async function () {
      generate.disabled = true;
      generate.textContent = 'Generating...';
      try {
        var data = await WasteLoopApi.createCertificate(pickup.id);
        window.location.href = 'certificate.html?id=' + encodeURIComponent(data.certificate.id);
      } catch (error) {
        WasteLoopValidation.setMessage(els.message, error.message, 'error');
        generate.disabled = false;
        generate.textContent = 'Generate Certificate';
      }
    });

    els.certificateBox.appendChild(generate);
  }

  function initMap() {
    if (state.leafletMap || typeof L === 'undefined') return;
    var mapEl = document.getElementById('track-map');
    if (!mapEl) return;

    try {
      state.leafletMap = L.map('track-map', {
        zoomControl: true,
        scrollWheelZoom: false
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
      }).addTo(state.leafletMap);

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
        html: '<div class="leaflet-depot-inner">♻️<span class="leaflet-marker-label">Depot</span></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      L.marker(DEPOT_COORDS, { icon: depotIcon })
        .addTo(state.leafletMap)
        .bindPopup('<b>Municipal Solid Waste Recovery Depot</b>');

      L.marker(HOME_COORDS, { icon: homeIcon })
        .addTo(state.leafletMap)
        .bindPopup('<b>Citizen Premises</b>');

      state.vehicleMarker = L.marker(GPS_WAYPOINTS[0], { icon: vehicleIcon })
        .addTo(state.leafletMap);

      L.polyline(GPS_WAYPOINTS, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.55,
        dashArray: '8, 8'
      }).addTo(state.leafletMap);

      state.trailPolyline = L.polyline([GPS_WAYPOINTS[0]], {
        color: '#16a34a',
        weight: 5,
        opacity: 0.95
      }).addTo(state.leafletMap);

      state.leafletMap.fitBounds(L.latLngBounds(GPS_WAYPOINTS), {
        padding: [30, 30]
      });

      setTimeout(function () {
        if (state.leafletMap) state.leafletMap.invalidateSize();
      }, 300);

    } catch (e) {
      console.error('Leaflet map initialization failed:', e);
    }
  }

  function finish() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    var finalCoord = GPS_WAYPOINTS[GPS_WAYPOINTS.length - 1];
    if (state.vehicleMarker) state.vehicleMarker.setLatLng(finalCoord);

    state.coveredPath.push(finalCoord);
    if (state.trailPolyline) state.trailPolyline.setLatLngs(state.coveredPath);

    renderLiveValues('Completed');
    renderTimeline('Completed');

    setTimeout(async function () {
      await saveStatus('Completed');
      state.pickup.status = 'Completed';
      renderCertificateAction();
      WasteLoopValidation.setMessage(
        els.message,
        'Pickup ' + state.pickup.id + ' completed. A digital recycling certificate is now available.',
        'success'
      );
    }, 700);
  }

  function tick() {
    state.step += 1;
    var progress = progressPercent() / 100;
    var coord = coordAtProgress(progress);

    if (state.vehicleMarker) state.vehicleMarker.setLatLng(coord);

    state.coveredPath.push(coord);
    if (state.trailPolyline) state.trailPolyline.setLatLngs(state.coveredPath);

    var statusName = statusForProgress();
    renderLiveValues(statusName);

    if (STATUS_FLOW.indexOf(statusName) !== state.statusIndex) {
      state.statusIndex = STATUS_FLOW.indexOf(statusName);
      renderTimeline(statusName);
      saveStatus(statusName);
    }

    if (state.step >= TOTAL_STEPS) finish();
  }

  function startSimulation() {
    if (state.timer) clearInterval(state.timer);

    state.step = 0;
    state.coveredPath = [GPS_WAYPOINTS[0]];
    state.statusIndex = -1;
    state.savedStatuses = [];

    if (state.vehicleMarker) state.vehicleMarker.setLatLng(GPS_WAYPOINTS[0]);
    if (state.trailPolyline) state.trailPolyline.setLatLngs(state.coveredPath);

    renderLiveValues('Collector Assigned');
    renderTimeline('Collector Assigned');

    state.timer = setInterval(tick, TICK_MS);
  }

  async function loadPickup(id) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    WasteLoopValidation.setMessage(els.message, 'Fetching live GPS status for ' + id + '...', 'success');
    if (els.panel) els.panel.hidden = true;

    try {
      var data = await WasteLoopApi.getPickup(id);
      state.pickup = data.pickup;
      if (els.lookup) els.lookup.hidden = true;
      if (els.panel) els.panel.hidden = false;

      initMap();
      renderDetails();
      renderCertificateAction();

      if (state.leafletMap) {
        setTimeout(function () {
          state.leafletMap.invalidateSize();
        }, 200);
      }

      if (state.pickup.status === 'Completed') {
        state.step = TOTAL_STEPS;
        var endCoord = GPS_WAYPOINTS[GPS_WAYPOINTS.length - 1];
        if (state.vehicleMarker) state.vehicleMarker.setLatLng(endCoord);
        if (state.trailPolyline) state.trailPolyline.setLatLngs(GPS_WAYPOINTS);
        renderLiveValues('Completed');
        renderTimeline('Completed');
        WasteLoopValidation.setMessage(
          els.message,
          'Pickup ' + state.pickup.id + ' is already Completed.',
          'success'
        );
      } else {
        renderLiveValues(state.pickup.status);
        renderTimeline(state.pickup.status);
        WasteLoopValidation.setMessage(
          els.message,
          'Live GPS tracking connected for ' + state.pickup.id + '.',
          'success'
        );
        startSimulation();
      }
    } catch (error) {
      WasteLoopValidation.setMessage(els.message, error.message, 'error');
    }
  }

  if (els.form) {
    els.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = els.input.value.trim().toUpperCase();
      if (!id) {
        WasteLoopValidation.setMessage(els.message, 'Please enter a Pickup Request ID.', 'error');
        els.input.focus();
        return;
      }
      loadPickup(id);
    });
  }

  var trackButton = document.getElementById('track-live');
  if (trackButton) {
    trackButton.addEventListener('click', function () {
      if (state.pickup) startSimulation();
    });
  }

  var params = new URLSearchParams(window.location.search);
  var initialId = params.get('id');

  WasteLoopApi.listPickups('limit=50')
    .then(function (data) {
      if (!els.hint) return;
      var live = data.pickups.filter(function (pickup) {
        return pickup.status !== 'Completed';
      });
      if (!live.length) return;

      var select = document.createElement('select');
      select.className = 'inline-select';
      select.setAttribute('aria-label', 'Select a pickup request to track');
      select.appendChild(new Option('Select a pickup request ID', ''));
      live.forEach(function (pickup) {
        select.appendChild(
          new Option(pickup.id + ' — ' + pickup.citizenName, pickup.id)
        );
      });

      select.addEventListener('change', function () {
        if (!select.value) return;
        els.input.value = select.value;
        loadPickup(select.value);
      });

      els.hint.innerHTML = '';
      els.hint.appendChild(select);
    })
    .catch(function () {});

  if (initialId) {
    els.input.value = initialId;
    loadPickup(initialId);
  }
})();
