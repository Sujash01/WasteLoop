/**
 * WasteLoop — home page live statistics
 *
 * Fills the "Portal Activity Summary" cards with figures returned by
 * GET /api/impact, so the home page never shows invented numbers.
 *
 * Demonstrates: fetch(), Promise, async/await, try/catch, map(), DOM creation.
 */

(function () {
  var holder = document.getElementById('home-stats');
  if (!holder) return;

  function render(stats) {
    holder.innerHTML = '';

    stats.forEach(function (stat) {
      var card = document.createElement('article');
      card.className = 'stat-card';

      var figure = document.createElement('span');
      figure.className = 'stat-number';
      figure.textContent = stat.value;

      var caption = document.createElement('span');
      caption.textContent = stat.label;

      card.appendChild(figure);
      card.appendChild(caption);
      holder.appendChild(card);
    });
  }

  async function loadStats() {
    try {
      var data = await WasteLoopApi.getImpact();
      var totals = data.impact.totals;

      render([
        { value: String(totals.totalPickups), label: 'Pickup requests registered' },
        { value: String(totals.completedPickups), label: 'Pickups completed' },
        { value: totals.totalWasteKg + ' kg', label: 'Total waste recycled' },
        { value: totals.co2SavedKg + ' kg', label: 'Estimated CO2 saved' }
      ]);
    } catch (error) {
      holder.innerHTML = '';
      var card = document.createElement('article');
      card.className = 'stat-card';
      var caption = document.createElement('span');
      caption.textContent =
        'Start the WasteLoop server with "npm start" to see live portal statistics.';
      card.appendChild(caption);
      holder.appendChild(card);
    }
  }

  loadStats();

  /* -------------------------------------------------------------
     Live Tracking Map Showcase initialization
     ------------------------------------------------------------- */
  var trackMount = document.getElementById('home-tracking-mount');
  var trackInput = document.getElementById('home-track-input');
  var trackBtn = document.getElementById('home-track-btn');
  var trackerInstance = null;

  async function initLiveTracker(pickupId) {
    if (!trackMount || typeof WasteLoopLiveTracker === 'undefined') return;

    if (trackerInstance) {
      trackerInstance.destroy();
      trackerInstance = null;
    }

    var pickup = null;
    if (pickupId && pickupId !== 'demo') {
      try {
        var res = await WasteLoopApi.getPickup(pickupId);
        if (res && res.pickup) pickup = res.pickup;
      } catch (e) {
        console.warn('Could not load pickup ' + pickupId, e);
      }
    }

    if (!pickup) {
      try {
        var listRes = await WasteLoopApi.listPickups('limit=10');
        if (listRes && listRes.pickups && listRes.pickups.length) {
          pickup = listRes.pickups.find(function (p) { return p.status !== 'Completed'; }) || listRes.pickups[0];
        }
      } catch (e) {}
    }

    trackerInstance = WasteLoopLiveTracker.mount(trackMount, pickup, {
      isSubpage: false,
      autoStart: true
    });
  }

  if (trackBtn && trackInput) {
    trackBtn.addEventListener('click', function () {
      var val = trackInput.value.trim().toUpperCase();
      if (val) initLiveTracker(val);
    });
    trackInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var val = trackInput.value.trim().toUpperCase();
        if (val) initLiveTracker(val);
      }
    });
  }

  document.querySelectorAll('.chip-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      if (trackInput && id !== 'demo') trackInput.value = id;
      initLiveTracker(id);
    });
  });

  initLiveTracker();
})();
