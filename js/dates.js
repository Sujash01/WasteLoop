/**
 * WasteLoop — browser side date utilities
 *
 * This is the browser twin of lib/dates.js. The two files deliberately contain
 * the same logic so the date shown by the <input type="date"> and the date the
 * Node.js server accepts can never drift apart.
 *
 * BOOKING POLICY — a pickup may only be booked for a FUTURE date.
 * Today is rejected. The earliest selectable date is TOMORROW.
 *
 * WHY DAY NUMBERS?
 * A booking is a "date only" value with the shape YYYY-MM-DD. It carries no
 * time and no timezone. Comparing it against a raw timestamp is what causes
 * the classic "yesterday was rejected" bug in different timezones. Instead,
 * every calendar day is turned into a plain integer (days since 1970-01-01)
 * using Date.UTC(). Comparing two integers is pure calendar arithmetic, so the
 * answer is the same everywhere in the world.
 */

var WasteLoopDates = (function () {
  var DAY_MS = 24 * 60 * 60 * 1000;
  var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * YYYY-MM-DD -> day number.
   * @returns {number|null} null when the string is not a real calendar date.
   */
  function toDayNumber(value) {
    if (typeof value !== 'string') return null;
    var trimmed = value.trim();
    if (!ISO_DATE.test(trimmed)) return null;

    var parts = trimmed.split('-').map(Number);
    var year = parts[0];
    var month = parts[1];
    var day = parts[2];

    var dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);

    // Round-trip guard: Date.UTC silently rolls 2026-02-31 over to 03-03.
    var roundTrip = new Date(dayNumber * DAY_MS);
    if (
      roundTrip.getUTCFullYear() !== year ||
      roundTrip.getUTCMonth() !== month - 1 ||
      roundTrip.getUTCDate() !== day
    ) {
      return null;
    }
    return dayNumber;
  }

  /** day number -> YYYY-MM-DD */
  function toIsoDate(dayNumber) {
    return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
  }

  /** Today (YYYY-MM-DD) on the visitor's own clock. */
  function todayIso(now) {
    var reference = now || new Date();
    return toIsoDate(
      Math.floor(Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()) / DAY_MS)
    );
  }

  /** Tomorrow (YYYY-MM-DD) on the visitor's own clock. */
  function tomorrowIso(now) {
    return toIsoDate(toDayNumber(todayIso(now)) + 1);
  }

  /**
   * Shift a YYYY-MM-DD string by whole days. addDays('2026-10-06', -1) ->
   * '2026-10-05'. Works across month and year boundaries.
   */
  function addDays(isoDate, days) {
    var day = toDayNumber(isoDate);
    if (day === null) return isoDate;
    return toIsoDate(day + days);
  }

  /**
   * THE booking policy check, run again in JavaScript on submit so a request
   * cannot slip past the HTML min attribute.
   *
   * @param {string} value the YYYY-MM-DD chosen by the citizen
   * @returns {{valid: boolean, reason: string, minIso: string, chosenIso: string|null}}
   */
  function validateBookingDate(value) {
    var minIso = tomorrowIso();

    if (typeof value !== 'string' || !value.trim()) {
      return { valid: false, reason: 'Pickup date is required.', minIso: minIso, chosenIso: null };
    }
    if (!ISO_DATE.test(value.trim())) {
      return {
        valid: false,
        reason: 'Pickup date must be a valid calendar date.',
        minIso: minIso,
        chosenIso: null
      };
    }

    var chosen = toDayNumber(value);
    if (chosen === null) {
      return {
        valid: false,
        reason: 'Pickup date must be a valid calendar date.',
        minIso: minIso,
        chosenIso: null
      };
    }
    if (chosen < toDayNumber(minIso)) {
      return {
        valid: false,
        reason: 'Pickup date must be a future date. Please select tomorrow or a later date.',
        minIso: minIso,
        chosenIso: value
      };
    }
    return { valid: true, reason: '', minIso: minIso, chosenIso: value };
  }

  /** "06 October 2026" — used by the certificate and the tracking page. */
  function formatLongDate(value) {
    var day = typeof value === 'string' ? toDayNumber(value) : null;
    var date = day === null ? new Date(value) : new Date(day * DAY_MS);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  /**
   * Load the server's idea of "tomorrow" once, so the browser calendar matches
   * the server policy even if the two clocks are in different timezones.
   *
   * The visitor's own timezone offset is sent along, so the server returns the
   * minimum it will actually accept for THIS browser. Falls back to the local
   * calculation when the API is unreachable.
   * @returns {Promise<string>} YYYY-MM-DD
   */
  function fetchMinimumDate() {
    if (typeof fetch !== 'function') return Promise.resolve(tomorrowIso());
    var offset = new Date().getTimezoneOffset();
    var apiBase = '';
    if (typeof WasteLoopApi !== 'undefined' && WasteLoopApi.getBaseUrl) {
      apiBase = WasteLoopApi.getBaseUrl();
    } else if (typeof window !== 'undefined' && window.WASTELOOP_API_BASE) {
      apiBase = window.WASTELOOP_API_BASE.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined' && window.location) {
      var port = window.location.port;
      if (window.location.protocol === 'file:' || (port && port !== '3000')) {
        apiBase = 'http://127.0.0.1:3000';
      }
    }
    return fetch(apiBase + '/api/meta?tz=' + encodeURIComponent(offset))
      .then(function (response) {
        return response.ok ? response.json() : Promise.reject(new Error('meta unavailable'));
      })
      .then(function (data) {
        return data && data.minimumPickupDate ? data.minimumPickupDate : tomorrowIso();
      })
      .catch(function () {
        return tomorrowIso();
      });
  }

  return {
    DAY_MS: DAY_MS,
    toDayNumber: toDayNumber,
    toIsoDate: toIsoDate,
    todayIso: todayIso,
    tomorrowIso: tomorrowIso,
    addDays: addDays,
    validateBookingDate: validateBookingDate,
    formatLongDate: formatLongDate,
    fetchMinimumDate: fetchMinimumDate
  };
})();
