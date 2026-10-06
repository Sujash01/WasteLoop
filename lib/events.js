/**
 * WasteLoop — application event bus (Node.js core module: events)
 *
 * Every important service action emits an event. Handlers registered in
 * lib/workflows.js react to those events (assign a collector, award green
 * points, write a certificate, ...). This keeps the request handler simple
 * and makes the pickup lifecycle easy to explain during an evaluation.
 */

'use strict';

const EventEmitter = require('events');

const bus = new EventEmitter();
// A prototype does not need the default 10-listener warning.
bus.setMaxListeners(50);

/**
 * Emit a WasteLoop event and print it in the terminal (educational console log).
 * @param {string} name
 * @param {object} payload
 */
function emit(name, payload = {}) {
  bus.emit(name, payload);
  const summary = Object.keys(payload)
    .slice(0, 4)
    .map((key) => `${key}=${formatValue(payload[key])}`)
    .join(' ');
  console.log(`[event] ${name}${summary ? ' :: ' + summary : ''}`);
}

function formatValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);
  return String(value).slice(0, 60);
}

/**
 * Wait for an event to arrive (returns a Promise).
 * Used by the pickup route: it emits pickupRequested and then waits for the
 * pickupAssigned event that the workflow listener produces, so the HTTP response
 * already contains the assigned collector.
 *
 * @param {string} eventName
 * @param {Function} [predicate] inspects the payload, e.g. match on pickupId
 * @param {number} [timeoutMs]
 */
function waitFor(eventName, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      bus.removeListener(eventName, listener);
      resolve(null);
    }, timeoutMs);

    function listener(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      bus.removeListener(eventName, listener);
      resolve(payload);
    }

    bus.on(eventName, listener);
  });
}

module.exports = { bus, emit, waitFor };