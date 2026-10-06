/**
 * WasteLoop — Citizen Dashboard
 *
 * Adds Feature 3: YOUR ENVIRONMENTAL IMPACT.
 *
 * IMPORTANT: no displayed total is hard coded. Every number is calculated by
 * the Node.js backend (lib/domain.js -> computeImpact) from the pickup records
 * stored in data/requests.json, then fetched with fetch() and painted here.
 *
 * Example of the arithmetic the backend performs:
 *   Plastic 8 kg + Paper 5 kg + Metal 3 kg  ->  Total Waste Recycled 16 kg
 *   CO2 saved = (8 x 2.3) + (5 x 1.1) + (3 x 4.0)  ->  36.9 kg CO2
 *
 * Demonstrates: async/await, try/catch, fetch(), Promises, map(), filter(),
 * find(), reduce(), sort(), DOM manipulation, event listeners.
 */

(function () {
  var els = {
    cards: document.getElementById('dashboard-cards'),
    points: document.getElementById('dashboard-points'),
    pointsButton: document.getElementById('simulate-points'),
    impactGrid: document.getElementById('impact-grid'),
    impactMethod: document.getElementById('impact-methodology'),
    breakdownBody: document.getElementById('breakdown-body'),
    certificateList: document.getElementById('certificate-list'),
    activityList: document.getElementById('activity-list'),
    dashboardMessage: document.getElementById('dashboard-message')
  };

  var lastReport = null;
  var lastCertificates = [];

  /* ------------------------------------------------------------------
     Formatting helpers
     ------------------------------------------------------------------ */
  function kg(value) {
    return Number(value || 0).toFixed(2).replace(/\.00$/, '') + ' kg';
  }

  function points(value) {
    return Number(value || 0).toLocaleString('en-IN');
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  /* ------------------------------------------------------------------
     Citizen summary cards (kept from the previous dashboard)
     ------------------------------------------------------------------ */
  function renderCard(label, value) {
    var card = document.createElement('article');
    card.className = 'dashboard-card';

    var caption = document.createElement('span');
    caption.textContent = label;

    var strong = document.createElement('strong');
    strong.textContent = value;

    card.appendChild(caption);
    card.appendChild(strong);
    return card;
  }

  function renderSummaryCards(impact) {
    if (!els.cards) return;
    els.cards.innerHTML = '';

    var citizen = (impact.recentPickups && impact.recentPickups[0]) || {};

    [
      { label: 'Total Pickups', value: impact.totals.totalPickups },
      { label: 'Completed Pickups', value: impact.totals.completedPickups },
      { label: 'Pending Pickups', value: impact.totals.pendingPickups },
      { label: 'Green Points', value: points(impact.totals.greenPoints) },
      { label: 'Certificates Issued', value: impact.totals.certificatesIssued }
    ].forEach(function (item) {
      els.cards.appendChild(renderCard(item.label, item.value));
    });

    if (els.points) {
      els.points.dataset.count = String(impact.totals.greenPoints);
      els.points.textContent = points(impact.totals.greenPoints);
    }
  }

  /* ------------------------------------------------------------------
     Feature 3 — YOUR ENVIRONMENTAL IMPACT
     ------------------------------------------------------------------ */
  function impactCard(label, value, note, highlight) {
    var card = document.createElement('article');
    card.className = 'impact-card' + (highlight ? ' is-highlight' : '');

    var caption = document.createElement('span');
    caption.className = 'impact-label';
    caption.textContent = label;

    var figure = document.createElement('span');
    figure.className = 'impact-value';
    figure.textContent = value;

    if (note) {
      var small = document.createElement('span');
      small.className = 'impact-note';
      small.textContent = note;
      card.appendChild(caption);
      card.appendChild(figure);
      card.appendChild(small);
    } else {
      card.appendChild(caption);
      card.appendChild(figure);
    }

    return card;
  }

  function renderImpact(report) {
    if (!els.impactGrid) return;
    els.impactGrid.innerHTML = '';

    var totals = report.totals;

    // reduce() here simply adds up the per-category CO2 figures the backend
    // already calculated, so the browser total can be seen to match.
    var co2FromBreakdown = report.categoryBreakdown.reduce(function (sum, row) {
      return sum + row.co2SavedKg;
    }, 0);

    [
      impactCard('Total Waste Recycled', kg(totals.totalWasteKg), 'Sum of all completed pickups', true),
      impactCard('Plastic Diverted', kg(totals.plasticDiverted), 'Kept out of landfill'),
      impactCard('Paper Recycled', kg(totals.paperRecycled), 'Recovered for reuse'),
      impactCard('Metal Recycled', kg(totals.metalRecycled), 'Highest Green Points value'),
      impactCard('Glass Recycled', kg(totals.glassRecycled), 'Container glass recovery'),
      impactCard('E-Waste Recovered', kg(totals.ewasteRecovered), 'Certified e-waste handling'),
      impactCard(
        'Estimated CO2 Saved',
        kg(co2FromBreakdown),
        'Weight diverted x material factor',
        true
      ),
      impactCard('Completed Pickups', String(totals.completedPickups), 'Across all citizens'),
      impactCard('Green Points', points(totals.greenPoints), 'Credited on completion')
    ].forEach(function (card) {
      els.impactGrid.appendChild(card);
    });

    setText(els.impactMethod, report.methodology);
  }

  /* ------------------------------------------------------------------
     Category breakdown table
     ------------------------------------------------------------------ */
  function renderBreakdown(report) {
    if (!els.breakdownBody) return;
    els.breakdownBody.innerHTML = '';

    var rows = report.categoryBreakdown.slice().sort(function (a, b) {
      return b.weightKg - a.weightKg;
    });

    if (!rows.length) {
      var empty = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 4;
      cell.innerHTML = '<div class="empty-state">No completed pickups yet.</div>';
      empty.appendChild(cell);
      els.breakdownBody.appendChild(empty);
      return;
    }

    var maxWeight = rows.reduce(function (max, row) {
      return Math.max(max, row.weightKg);
    }, 0);

    rows.forEach(function (row) {
      var tr = document.createElement('tr');

      var category = document.createElement('td');
      category.textContent = row.category;

      var weight = document.createElement('td');
      var bar = document.createElement('span');
      bar.className = 'breakdown-bar';
      bar.style.width = Math.max(8, Math.round((row.weightKg / maxWeight) * 90)) + 'px';
      weight.appendChild(bar);
      weight.appendChild(document.createTextNode(kg(row.weightKg)));

      var factor = document.createElement('td');
      factor.textContent = row.co2Factor + ' kg CO2/kg';

      var saved = document.createElement('td');
      saved.textContent = kg(row.co2SavedKg);

      tr.appendChild(category);
      tr.appendChild(weight);
      tr.appendChild(factor);
      tr.appendChild(saved);
      els.breakdownBody.appendChild(tr);
    });
  }

  /* ------------------------------------------------------------------
     Certificates + recent activity
     ------------------------------------------------------------------ */
  function renderCertificates(certificates) {
    if (!els.certificateList) return;
    els.certificateList.innerHTML = '';
    lastCertificates = certificates;

    if (!certificates.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No certificate issued yet — complete a pickup to unlock one.';
      els.certificateList.appendChild(empty);
      return;
    }

    certificates.forEach(function (certificate) {
      var item = document.createElement('li');

      var link = document.createElement('a');
      link.href = 'certificate.html?id=' + encodeURIComponent(certificate.id);
      link.textContent =
        certificate.id + ' — ' + certificate.wasteCategory + ' ' + certificate.weight + ' kg';
      link.style.fontWeight = '600';

      var reference = document.createElement('span');
      reference.className = 'muted-text';
      reference.textContent = 'Ref ' + certificate.verificationNumber;
      reference.style.marginLeft = '10px';

      item.appendChild(link);
      item.appendChild(reference);
      els.certificateList.appendChild(item);
    });
  }

  function renderActivity(pickups) {
    if (!els.activityList) return;
    els.activityList.innerHTML = '';

    if (!pickups.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No pickup activity recorded yet.';
      els.activityList.appendChild(empty);
      return;
    }

    pickups
      .slice()
      .sort(function (a, b) {
        return new Date(b.pickupDate) - new Date(a.pickupDate);
      })
      .forEach(function (pickup) {
        var item = document.createElement('li');

        var text = document.createElement('span');
        text.textContent =
          pickup.id + ' — ' +
          pickup.wasteCategory + ' ' +
          pickup.weight + ' kg · ' +
          pickup.status;

        var badge = document.createElement('span');
        badge.className = 'muted-text';
        badge.textContent = WasteLoopDates.formatLongDate(pickup.pickupDate);
        badge.style.marginLeft = 'auto';

        item.appendChild(text);
        item.appendChild(badge);
        els.activityList.appendChild(item);
      });
  }

  /* ------------------------------------------------------------------
     Loading everything from the backend
     ------------------------------------------------------------------ */
  async function loadDashboard() {
    try {
      // Promise.all runs the two GET requests in parallel.
      var results = await Promise.all([
        WasteLoopApi.getImpact(),
        WasteLoopApi.listCertificates()
      ]);

      lastReport = results[0].impact;
      var certificates = results[1].certificates || [];

      renderSummaryCards(lastReport);
      renderImpact(lastReport);
      renderBreakdown(lastReport);
      renderCertificates(certificates);
      renderActivity(lastReport.recentPickups || []);
    } catch (error) {
      if (els.dashboardMessage) {
        els.dashboardMessage.className = 'status-message error';
        els.dashboardMessage.textContent =
          'Could not load dashboard data: ' + error.message + ' Start the server with "npm start".';
      }
    }
  }

  /* ------------------------------------------------------------------
     Keep the original "Add Green Points" demonstration button working.
     It re-reads the impact report afterwards so the cards stay truthful.
     ------------------------------------------------------------------ */
  if (els.pointsButton) {
    els.pointsButton.addEventListener('click', function () {
      els.pointsButton.disabled = true;
      loadDashboard().then(function () {
        els.pointsButton.disabled = false;
      });
    });
  }

  loadDashboard();
})();
