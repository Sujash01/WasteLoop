/**
 * WasteLoop — date utilities (shared logic, duplicated in js/dates.js for the browser)
 *
 * WasteLoop booking policy: a pickup must be scheduled for a FUTURE date only.
 * The earliest selectable date is TOMORROW. Today and any earlier date is rejected.
 *
 * How timezone problems are avoided:
 * A booking is a "date only" value with the shape YYYY-MM-DD. It has no time and
 * no timezone, so we never compare it against a raw server timestamp (that would
 * reject valid dates because of UTC offsets and DST).
 * Instead every calendar day is converted to a plain integer "day number"
 * (days since 1970-01-01) using Date.UTC(). Comparing two day numbers is a pure
 * calendar comparison, so the result is identical in every timezone.
 */

'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convert a YYYY-MM-DD string into a day number (days since epoch).
 * Returns null when the string is not a real calendar date
 * (this rejects values such as 2026-02-31 or 2026-13-01).
 */
function toDayNumber(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) return null;

  const parts = trimmed.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);

  // Round-trip check: Date.UTC rolls over invalid dates (Feb 31 -> Mar 3).
  const roundTrip = new Date(dayNumber * DAY_MS);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return dayNumber;
}

/** Convert a day number back into YYYY-MM-DD. */
function toIsoDate(dayNumber) {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/**
 * "Now" on the calendar of a client whose clock offset is known.
 * Date.getTimezoneOffset() returns the minutes to ADD to local time to reach UTC
 * (India = -330), so clientLocalTime === utcNow - offsetMinutes.
 */
function nowForOffset(now, timezoneOffsetMinutes) {
  const offset = Number(timezoneOffsetMinutes);
  if (!Number.isFinite(offset)) return new Date(now.getTime());
  return new Date(now.getTime() - offset * 60 * 1000);
}

/**
 * Earliest allowed booking day.
 * @param {Date} now              current moment on the relevant clock
 * @param {number} [offsetMinutes] timezone offset of the citizen's browser
 */
function earliestBookingDay(now, offsetMinutes) {
  const reference = nowForOffset(now, offsetMinutes);
  const todayNumber = Math.floor(
    Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()) / DAY_MS
  );
  return todayNumber + 1; // tomorrow
}

/**
 * Validate a booking date against the future-date-only policy.
 * @returns {{valid: boolean, reason?: string, minIso?: string}}
 */
function validateBookingDate(value, options = {}) {
  const now = options.now || new Date();
  const minDay = earliestBookingDay(now, options.timezoneOffsetMinutes);

  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, reason: 'Pickup date is required.', minIso: toIsoDate(minDay) };
  }
  if (!ISO_DATE.test(value.trim())) {
    return {
      valid: false,
      reason: 'Pickup date must be a valid calendar date.',
      minIso: toIsoDate(minDay)
    };
  }
  const day = toDayNumber(value);
  if (day === null) {
    return {
      valid: false,
      reason: 'Pickup date must be a valid calendar date.',
      minIso: toIsoDate(minDay)
    };
  }
  if (day < minDay) {
    return {
      valid: false,
      reason: 'Pickup date must be a future date. Please select tomorrow or a later date.',
      minIso: toIsoDate(minDay)
    };
  }
  return { valid: true, minIso: toIsoDate(minDay) };
}

/** Human readable date, e.g. "06 October 2026" (used on certificates). */
function formatLongDate(value) {
  const day = typeof value === 'string' ? toDayNumber(value) : null;
  const date = day === null ? new Date(value) : new Date(day * DAY_MS);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/** Shift a YYYY-MM-DD string by a whole number of days. */
function addDays(isoDate, days) {
  const day = toDayNumber(isoDate);
  if (day === null) return isoDate;
  return toIsoDate(day + days);
}

/** Today's date (YYYY-MM-DD) on the server clock. */
function todayIso(now = new Date()) {
  return toIsoDate(
    Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS)
  );
}

module.exports = {
  DAY_MS,
  toDayNumber,
  toIsoDate,
  nowForOffset,
  earliestBookingDay,
  validateBookingDate,
  formatLongDate,
  addDays,
  todayIso
};