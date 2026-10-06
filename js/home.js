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
})();
