/**
 * WasteLoop — Feature 1: Live Garbage Collector Tracking
 *
 * An "Uber style" simulated tracking view built with plain DOM manipulation.
 * There is no Google Maps API and no real GPS: the collector vehicle follows a
 * predefined route of { x, y } points (percentages of the map box) and the
 * marker is moved with setInterval().
 *
 * While the vehicle moves:
 *   - the remaining distance decreases
 *   - the ETA decreases
 *   - the status advances through the official flow
 *   - each new status is written back to the Node.js backend
 *
 * Demonstrates: arrays, objects, map(), filter(), find(), reduce(), sort(),
 * setInterval(), clearInterval(), setTimeout(), callbacks, Promises,
 * async/await, try/catch, JSON, fetch(), addEventListener().
 */

(function () {
  /* ------------------------------------------------------------------
     THE SIMULATED MAP
     A route is a list of waypoints expressed as percentages of the map
     box, so it scales to any screen size. The citizen home is always the
     final waypoint.
     ------------------------------------------------------------------ */
  var ROUTE = [
    { x: 8, y: 86 },
    { x: 20, y: 78 },
    { x: 34, y: 70 },
    { x: 48, y: 62 },
    { x: 62, y: 52 },
    { x: 74, y: 42 },
    { x: 84, y: 32 },
    { x: 91, y: 24 }
  ];

  var HOME = { x: 93, y: 20 };

  // Simulation speed: how many milliseconds one movement step takes.
  var TICK_MS = 900;
  // How many steps the vehicle takes to reach the home marker.
  var TOTAL_STEPS = 120;

  /* Status thresholds, expressed as a percentage of the journey completed. */
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
    vehicle: document.getElementById('vehicle-marker'),
    home: document.getElementById('home-marker'),
    routeSvg: document.getElementById('route-line'),
    trailSvg: document.getElementById('trail-line'),
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
    trail: [],
    statusIndex: -1,
    savedStatuses: []
  };

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */

  function round(value, places) {
    var factor = Math.pow(10, places || 1);
    return Math.round(value * factor) / factor;
  }

  /** Total length of the route in map units (used to normalise progress). */
  var routeLength = ROUTE.reduce(function (total, point, index) {
    if (index === 0) return total;
    var previous = ROUTE[index - 1];
    var dx = point.x - previous.x;
    var dy = point.y - previous.y;
    return total + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  /**
   * Position after `step` of TOTAL_STEPS.
   * Uses map(), reduce() and Math.round to walk the polyline — an easy
   * piece of code to explain.
   */
  function pointAtProgress(progress) {
    var target = progress * routeLength;
    var walked = 0;

    var segments = ROUTE.map(function (point, index) {
      if (index === 0) return { from: point, to: point, length: 0 };
      var previous = ROUTE[index - 1];
      var dx = point.x - previous.x;
      var dy = point.y - previous.y;
      return { from: previous, to: point, length: Math.sqrt(dx * dx + dy * dy) };
    });

    var segment = segments.filter(function (candidate) {
      if (candidate.length === 0) return false;
      return target <= walked + candidate.length;
    })[0];

    if (!segment) {
      var last = ROUTE[ROUTE.length - 1];
      return { x: last.x, y: last.y };
    }

    if (segment.length === 0) return { x: segment.from.x, y: segment.from.y };

    var covered = target - walked;
    var ratio = segment.length === 0 ? 0 : covered / segment.length;
    return {
      x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
      y: segment.from.y + (segment.to.y - segment.from.y) * ratio
    };
  }

  function progressPercent() {
    return Math.min(100, (state.step / TOTAL_STEPS) * 100);
  }

  /* ------------------------------------------------------------------
     Painting the map
     ------------------------------------------------------------------ */

  function placeMarker(element, point) {
    if (!element) return;
    element.style.left = point.x + '%';
    element.style.top = point.y + '%';
  }

  function drawStaticRoute() {
    if (!els.routeSvg) return;
    var points = ROUTE.concat([HOME]).map(function (point) {
      return point.x + ',' + point.y;
    });
    // viewBox is 0 0 100 100 with preserveAspectRatio="none", so the
    // percentage coordinates can be written straight into the polyline.
    els.routeSvg.setAttribute('points', points.join(' '));
  }

  function drawTrail() {
    if (!els.trailSvg) return;
    var last = state.trail[state.trail.length - 1];
    if (!last) return;
    var points = state.trail
      .concat([last])
      .map(function (point) {
        return point.x + ',' + point.y;
      });
    els.trailSvg.setAttribute('points', points.join(' '));
  }

  function renderTimeline(statusName) {
    var currentIndex = STATUS_FLOW.indexOf(statusName);
    Array.prototype.forEach.call(els.steps, function (step, index) {
      step.classList.toggle('completed', index < currentIndex);
      step.classList.toggle('active', index === currentIndex);
    });
  }

  /* ------------------------------------------------------------------
     Rendering the detail panel
     ------------------------------------------------------------------ */

  function setText(element, value) {
    if (element) element.textContent = value;
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

    if (pickup.address) {
      setText(document.getElementById('detail-address'), pickup.address);
    }

    placeMarker(els.home, HOME);
  }

  /** Distance shrinks as the vehicle closes in on the home marker. */
  function remainingDistance() {
    var total = Number(state.pickup.distanceKm) || 1.8;
    return round(total * (1 - progressPercent() / 100), 1);
  }

  /** ETA shrinks proportionally, never below zero. */
  function remainingEta() {
    var total = Number(state.pickup.etaMinutes) || 8;
    return Math.max(0, Math.round(total * (1 - progressPercent() / 100)));
  }

  function renderLiveValues(statusName) {
    setText(els.distance, remainingDistance() + ' km');
    setText(els.eta, remainingEta() + ' minutes');
    setText(els.status, statusName);

    var percent = Math.round(progressPercent());
    if (els.progressBar) els.progressBar.style.width = percent + '%';
    if (els.progressText) els.progressText.textContent = percent + '% of journey completed';
  }

  /** Which status belongs to the current progress percentage? */
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

  /* ------------------------------------------------------------------
     Persisting a status change to the backend
     ------------------------------------------------------------------ */

  function saveStatus(statusName) {
    if (!state.pickup) return Promise.resolve(null);

    // Do not send the same status twice.
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

  /* ------------------------------------------------------------------
     Certificate — only offered once the pickup is Completed
     ------------------------------------------------------------------ */

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
        WasteLoopValidation.setMessage(message, error.message, 'error');
        generate.disabled = false;
        generate.textContent = 'Generate Certificate';
      }
    });

    els.certificateBox.appendChild(generate);
  }

  /* ------------------------------------------------------------------
     The animation loop
     ------------------------------------------------------------------ */

  function finish() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    var point = pointAtProgress(1);
    placeMarker(els.vehicle, point);
    state.trail.push(point);
    drawTrail();

    renderLiveValues('Completed');
    renderTimeline('Completed');
    if (els.vehicle) els.vehicle.classList.add('arrived');

    // Short setTimeout before the final write so the arrival is visible.
    setTimeout(async function () {
      await saveStatus('Completed');
      state.pickup.status = 'Completed';
      renderCertificateAction();
      WasteLoopValidation.setMessage(
        message,
        'Pickup ' + state.pickup.id + ' completed. A digital recycling certificate is now available.',
        'success'
      );
    }, 700);
  }

  function tick() {
    state.step += 1;

    var progress = progressPercent();
    var point = pointAtProgress(progress / 100);
    placeMarker(els.vehicle, point);
    state.trail.push(point);
    drawTrail();

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
    state.trail = [];
    state.statusIndex = -1;
    state.savedStatuses = [];

    var start = pointAtProgress(0);
    placeMarker(els.vehicle, start);
    drawStaticRoute();
    drawTrail();

    if (els.vehicle) els.vehicle.classList.remove('arrived');

    renderLiveValues('Collector Assigned');
    renderTimeline('Collector Assigned');

    // setInterval keeps calling tick() — that is the vehicle movement.
    state.timer = setInterval(tick, TICK_MS);
  }

  /* ------------------------------------------------------------------
     Loading a pickup
     ------------------------------------------------------------------ */

  async function loadPickup(id) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    WasteLoopValidation.setMessage(message, 'Fetching live status for ' + id + '...', 'success');
    els.panel.hidden = true;

    try {
      var data = await WasteLoopApi.getPickup(id);
      state.pickup = data.pickup;
      els.lookup.hidden = true;
      els.panel.hidden = false;

      renderDetails();
      renderCertificateAction();

      if (state.pickup.status === 'Completed') {
        // Already finished: show the end state instead of replaying the trip.
        state.step = TOTAL_STEPS;
        var point = pointAtProgress(1);
        placeMarker(els.vehicle, point);
        drawStaticRoute();
        renderLiveValues('Completed');
        renderTimeline('Completed');
        if (els.vehicle) els.vehicle.classList.add('arrived');
        WasteLoopValidation.setMessage(
          message,
          'Pickup ' + state.pickup.id + ' is already Completed.',
          'success'
        );
      } else {
        // Show the true stored status for one beat, then simulate the route.
        renderLiveValues(state.pickup.status);
        renderTimeline(state.pickup.status);
        WasteLoopValidation.setMessage(
          message,
          'Live tracking started for ' + state.pickup.id + '.',
          'success'
        );
        startSimulation();
      }
    } catch (error) {
      WasteLoopValidation.setMessage(message, error.message, 'error');
    }
  }

  /* ------------------------------------------------------------------
     Wiring up events
     ------------------------------------------------------------------ */

  if (els.form) {
    els.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = els.input.value.trim().toUpperCase();
      if (!id) {
        WasteLoopValidation.setMessage(message, 'Please enter a Pickup Request ID.', 'error');
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

  // Deep link from the pickup page: track.html?id=WL20491
  var params = new URLSearchParams(window.location.search);
  var initialId = params.get('id');

  drawStaticRoute();

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
    .catch(function () {
      /* the manual text field still works */
    });

  if (initialId) {
    els.input.value = initialId;
    loadPickup(initialId);
  }
})();
