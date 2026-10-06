/**
 * WasteLoop — API routes
 *
 * Handlers receive ({ params, query, body }) and return a plain object, which
 * server.js serialises as JSON. Throwing an error with `statusCode` produces a
 * proper error response without a framework.
 */

'use strict';

const store = require('./store');
const dates = require('./dates');
const domain = require('./domain');
const { emit, waitFor } = require('./events');
const { notifications } = require('./workflows');
const guide = require('./waste-guide');

/** Helper: build an HTTP error. */
function fail(statusCode, code, message, field) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.field = field;
  return error;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireText(body, field, label, extra) {
  const value = text(body[field]);
  if (!value) throw fail(400, 'VALIDATION_ERROR', (label || field) + ' is required.', field);
  if (extra && !extra(value)) {
    throw fail(400, 'VALIDATION_ERROR', (label || field) + ' is not valid.', field);
  }
  return value;
}

const isMobile = (value) => /^[6-9]\d{9}$/.test(value);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isPincode = (value) => /^\d{6}$/.test(value);

/**
 * Shared pickup date policy check.
 * The browser also blocks invalid dates, but the server never trusts the client.
 */
function assertFuturePickupDate(value, timezoneOffsetMinutes) {
  const result = dates.validateBookingDate(value, { timezoneOffsetMinutes });
  if (!result.valid) {
    throw fail(400, 'INVALID_PICKUP_DATE', result.reason, 'pickupDate');
  }
  return result.minIso;
}

/** POST /api/pickups — create a pickup request (future dates only). */
async function createPickup({ body }) {
  const citizenName = requireText(body, 'citizenName', 'Citizen name', (v) => v.length >= 3);
  const mobile = requireText(body, 'mobile', 'Mobile number', isMobile);
  const email = requireText(body, 'email', 'Email', isEmail);
  const city = requireText(body, 'city', 'City');
  const address = requireText(body, 'address', 'Address', (v) => v.length >= 8);
  const pincode = requireText(body, 'pincode', 'Pincode', isPincode);
  const wasteCategory = requireText(body, 'wasteCategory', 'Waste category', (value) =>
    guide.WASTE_CATEGORIES.includes(value)
  );
  const remarks = text(body.remarks);

  const weightValue = Number(body.weight);
  if (!Number.isFinite(weightValue) || weightValue <= 0 || weightValue > 500) {
    throw fail(400, 'VALIDATION_ERROR', 'Estimated weight must be a number between 1 and 500 kg.', 'weight');
  }

  // ---- CRITICAL DATE VALIDATION (dynamic, timezone safe) ----
  const pickupDate = requireText(body, 'pickupDate', 'Preferred pickup date');
  assertFuturePickupDate(pickupDate, body.clientTimezoneOffset);

  const pickup = {
    id: store.buildId('WL', { numberStyle: 'short' }),
    citizenName,
    mobile,
    email,
    address,
    city,
    pincode,
    wasteCategory,
    weight: Number(weightValue),
    pickupDate,
    remarks,
    status: 'Pending',
    statusHistory: [{ status: 'Pending', at: new Date().toISOString() }],
    collector: null,
    distanceKm: null,
    etaMinutes: null,
    certificateId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const stored = await store.insertRecord('requests', pickup);

  // pickupRequested -> save (done above) -> emit -> assign collector -> status update
  // The listener in lib/workflows.js needs the whole record, not just the id.
  const assignment = waitFor('pickupAssigned', (payload) => payload.pickupId === stored.id);
  emit('pickupRequested', { pickupId: stored.id, citizenName, pickup: stored });
  await assignment;
  const assigned = await store.findRecord('requests', stored.id);

  return { ok: true, message: 'Pickup request registered.', pickup: assigned || stored };
}

/** GET /api/pickups?status=&limit= — list pickup requests. */
async function listPickups({ query }) {
  const all = await store.readCollection('requests');
  const status = text(query.status);

  const filtered = status ? all.filter((row) => row.status === status) : all;
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 50;

  return {
    ok: true,
    count: sorted.length,
    total: all.length,
    pickups: sorted.slice(0, limit).map((pickup) => ({
      id: pickup.id,
      citizenName: pickup.citizenName,
      city: pickup.city,
      wasteCategory: pickup.wasteCategory,
      weight: pickup.weight,
      pickupDate: pickup.pickupDate,
      status: pickup.status,
      collector: pickup.collector,
      distanceKm: pickup.distanceKm,
      etaMinutes: pickup.etaMinutes,
      certificateId: pickup.certificateId,
      createdAt: pickup.createdAt
    }))
  };
}

/** GET /api/pickups/:id — single request used by the live tracking page. */
async function getPickup({ params }) {
  const pickup = await store.findRecord('requests', params.id);
  if (!pickup) throw fail(404, 'NOT_FOUND', 'No pickup request found with ID ' + params.id + '.');
  const certificates = await store.readCollection('certificates');
  return {
    ok: true,
    pickup: {
      ...pickup,
      certificate: certificates.find((row) => row.pickupId === pickup.id) || null
    }
  };
}

/** POST /api/pickups/:id/status — persist the live tracking status transitions. */
async function setPickupStatus({ params, body }) {
  const pickup = await store.findRecord('requests', params.id);
  if (!pickup) throw fail(404, 'NOT_FOUND', 'No pickup request found with ID ' + params.id + '.');

  const nextStatus = requireText(body, 'status', 'Status', (value) =>
    domain.PICKUP_STATUS_FLOW.includes(value)
  );

  const currentIndex = domain.PICKUP_STATUS_FLOW.indexOf(pickup.status);
  const nextIndex = domain.PICKUP_STATUS_FLOW.indexOf(nextStatus);
  if (nextIndex < currentIndex) {
    throw fail(409, 'INVALID_STATUS_TRANSITION', 'Status cannot move backwards from ' + pickup.status + '.');
  }

  const updated = await domain.updatePickupStatus(pickup, nextStatus);
  return { ok: true, message: 'Pickup status updated.', pickup: updated };
}

/** POST /api/grievances — citizen complaint / grievance registration. */
async function createGrievance({ body }) {
  const complaintType = requireText(body, 'complaintType', 'Complaint type', (value) =>
    guide.COMPLAINT_TYPES.includes(value)
  );
  const description = requireText(body, 'description', 'Description', (v) => v.length >= 15);
  const mobile = requireText(body, 'mobile', 'Mobile number', isMobile);
  const contactMethod = requireText(body, 'contactMethod', 'Preferred contact method', (value) =>
    guide.CONTACT_METHODS.includes(value)
  );
  const citizenName = requireText(body, 'citizenName', 'Citizen name');
  const pickupId = text(body.pickupId) || null;
  const email = text(body.email);
  if (email && !isEmail(email)) throw fail(400, 'VALIDATION_ERROR', 'Email is not valid.', 'email');

  if (pickupId) {
    const pickup = await store.findRecord('requests', pickupId);
    if (!pickup) {
      throw fail(400, 'VALIDATION_ERROR', 'Pickup Request ID ' + pickupId + ' was not found.', 'pickupId');
    }
  }

  const grievance = {
    id: store.buildId('GRV', { numberStyle: 'year' }),
    complaintType,
    pickupId,
    description,
    citizenName,
    mobile,
    email: email || null,
    contactMethod,
    status: 'Submitted',
    statusHistory: [{ status: 'Submitted', at: new Date().toISOString() }],
    reference: store.referenceNumber('GRF'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const stored = await store.insertRecord('grievances', grievance);
  emit('grievanceSubmitted', {
    grievanceId: stored.id,
    pickupId: stored.pickupId,
    complaintType: stored.complaintType
  });

  return {
    ok: true,
    message: 'Grievance registered with WasteLoop Grievance Redressal Cell.',
    grievance: stored
  };
}

/** GET /api/grievances/:id — grievance tracking. */
async function getGrievance({ params }) {
  const grievance = await store.findRecord('grievances', params.id);
  if (!grievance) throw fail(404, 'NOT_FOUND', 'No grievance found with ID ' + params.id + '.');
  return {
    ok: true,
    grievance: {
      ...grievance,
      statusFlow: domain.GRIEVANCE_STATUS_FLOW,
      nextStatus:
        domain.GRIEVANCE_STATUS_FLOW[
          Math.min(
            domain.GRIEVANCE_STATUS_FLOW.indexOf(grievance.status) + 1,
            domain.GRIEVANCE_STATUS_FLOW.length - 1
          )
        ]
    }
  };
}

/** GET /api/grievances — recent grievances (prototype listing). */
async function listGrievances() {
  const grievances = await store.readCollection('grievances');
  const sorted = [...grievances].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { ok: true, count: sorted.length, grievances: sorted.slice(0, 25) };
}

/**
 * POST /api/grievances/:id/status — move a grievance forward through
 * Submitted -> Under Review -> Assigned -> Resolved.
 * The "advance one step" helper is what the grievance page uses while the
 * citizen watches the redressal progress.
 */
async function setGrievanceStatus({ params, body }) {
  const grievance = await store.findRecord('grievances', params.id);
  if (!grievance) throw fail(404, 'NOT_FOUND', 'No grievance found with ID ' + params.id + '.');

  const currentIndex = domain.GRIEVANCE_STATUS_FLOW.indexOf(grievance.status);
  const requested = text(body.status);
  const nextStatus = requested || domain.GRIEVANCE_STATUS_FLOW[currentIndex + 1];
  const nextIndex = domain.GRIEVANCE_STATUS_FLOW.indexOf(nextStatus);

  if (nextIndex === -1) {
    throw fail(
      400,
      'VALIDATION_ERROR',
      'Status must be one of: ' + domain.GRIEVANCE_STATUS_FLOW.join(', '),
      'status'
    );
  }
  if (nextIndex < currentIndex) {
    throw fail(
      409,
      'INVALID_STATUS_TRANSITION',
      'Status cannot move backwards from ' + grievance.status + '.'
    );
  }

  const updated = await store.updateRecord('grievances', grievance.id, (row) => ({
    ...row,
    status: nextStatus,
    statusHistory: [...(row.statusHistory || []), { status: nextStatus, at: new Date().toISOString() }],
    updatedAt: new Date().toISOString()
  }));

  return {
    ok: true,
    message: 'Grievance ' + updated.id + ' is now ' + updated.status + '.',
    grievance: updated
  };
}

/** GET /api/impact — environmental impact dashboard data (calculated). */
async function getImpact({ query }) {
  const report = await domain.computeImpact({ limit: query.limit });
  return { ok: true, impact: report };
}

/** GET /api/waste-guide?q=phone — smart waste disposal guide data. */
async function getWasteGuide({ query }) {
  const matches = guide.searchWasteGuide(query.q);
  return {
    ok: true,
    query: text(query.q) || null,
    count: matches.length,
    items: matches,
    categories: guide.WASTE_CATEGORIES
  };
}

/** GET /api/certificates/:id — certificate for printing. */
async function getCertificate({ params }) {
  const certificate = await store.findRecord('certificates', params.id);
  if (!certificate) throw fail(404, 'NOT_FOUND', 'No certificate found with ID ' + params.id + '.');
  const pickup = await store.findRecord('requests', certificate.pickupId);
  return {
    ok: true,
    certificate: {
      ...certificate,
      issueDateLong: dates.formatLongDate(certificate.issuedOn),
      pickup: pickup
        ? {
            id: pickup.id,
            pickupDate: pickup.pickupDate,
            pickupDateLong: dates.formatLongDate(pickup.pickupDate),
            status: pickup.status,
            collector: pickup.collector,
            address: pickup.address
          }
        : null
    }
  };
}

/** GET /api/certificates — issued certificates + certificates still eligible. */
async function listCertificates() {
  const certificates = await store.readCollection('certificates');
  const requests = await store.readCollection('requests');
  const eligible = requests
    .filter((row) => row.status === 'Completed')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((row) => ({
      pickupId: row.id,
      citizenName: row.citizenName,
      wasteCategory: row.wasteCategory,
      weight: row.weight,
      status: row.status,
      certificateId: row.certificateId,
      pickupDate: row.pickupDate
    }));

  return { ok: true, count: certificates.length, certificates, eligible };
}

/** POST /api/certificates — issue a certificate (only for Completed pickups). */
async function createCertificate({ body }) {
  const pickupId = requireText(body, 'pickupId', 'Pickup request ID');
  const pickup = await store.findRecord('requests', pickupId);
  const certificate = await domain.generateCertificate(pickup);
  return {
    ok: true,
    message: 'Digital recycling certificate generated.',
    certificate: { ...certificate, issueDateLong: dates.formatLongDate(certificate.issuedOn) }
  };
}

/** GET /api/meta — reference data + the server's minimum booking date. */
async function getMeta(ctx) {
  const now = new Date();
  // Honour the caller's timezone so the minimum date returned here is exactly
  // the minimum POST /api/pickups will accept from that same caller. Without
  // this the browser calendar and the server policy could disagree by a day.
  const offset = ctx && ctx.query ? ctx.query.tz : undefined;
  const minDay = dates.earliestBookingDay(now, offset);
  return {
    ok: true,
    serverDate: dates.todayIso(now),
    clientOffsetApplied: offset !== undefined && offset !== null && offset !== '',
    minimumPickupDate: dates.toIsoDate(minDay),
    serverMinimumPickupDate: dates.toIsoDate(dates.earliestBookingDay(now)),
    bookingPolicy: 'Future dates only — earliest selectable pickup date is tomorrow.',
    wasteCategories: guide.WASTE_CATEGORIES,
    complaintTypes: guide.COMPLAINT_TYPES,
    contactMethods: guide.CONTACT_METHODS,
    pickupStatusFlow: domain.PICKUP_STATUS_FLOW,
    grievanceStatusFlow: domain.GRIEVANCE_STATUS_FLOW,
    collectors: domain.COLLECTORS,
    recyclingCentres: domain.RECYCLING_CENTRES
  };
}

/** GET /api/notifications — recent EventEmitter notifications (demo helper). */
async function getNotifications() {
  return { ok: true, notifications };
}

/**
 * Route table. Patterns use ":name" segments and are matched in order.
 */
const routes = [
  { method: 'POST', pattern: '/api/pickups', handler: createPickup },
  { method: 'GET', pattern: '/api/pickups', handler: listPickups },
  { method: 'GET', pattern: '/api/pickups/:id', handler: getPickup },
  { method: 'GET', pattern: '/api/pickups/:id/certificate', handler: async (ctx) => {
      const pickup = await store.findRecord('requests', ctx.params.id);
      if (!pickup) throw fail(404, 'NOT_FOUND', 'No pickup request found with ID ' + ctx.params.id + '.');
      const certificate = await domain.generateCertificate(pickup);
      return { ok: true, message: 'Digital recycling certificate generated.', certificate };
    } },
  { method: 'POST', pattern: '/api/pickups/:id/status', handler: setPickupStatus },

  { method: 'POST', pattern: '/api/grievances', handler: createGrievance },
  { method: 'GET', pattern: '/api/grievances', handler: listGrievances },
  { method: 'GET', pattern: '/api/grievances/:id', handler: getGrievance },
  { method: 'POST', pattern: '/api/grievances/:id/status', handler: setGrievanceStatus },

  { method: 'GET', pattern: '/api/impact', handler: getImpact },

  { method: 'GET', pattern: '/api/waste-guide', handler: getWasteGuide },

  { method: 'POST', pattern: '/api/certificates', handler: createCertificate },
  { method: 'GET', pattern: '/api/certificates', handler: listCertificates },
  { method: 'GET', pattern: '/api/certificates/:id', handler: getCertificate },

  { method: 'GET', pattern: '/api/meta', handler: getMeta },
  { method: 'GET', pattern: '/api/notifications', handler: getNotifications }
];

/** Convert "/api/pickups/:id" into a matcher. */
function compile(pattern) {
  const names = [];
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp('^' + source + '/?$'), names };
}

const compiled = routes.map((route) => ({ ...route, ...compile(route.pattern) }));

/**
 * Find the handler for a method + pathname.
 * @returns {{handler: Function, params: object}|null}
 */
function match(method, pathname) {
  const verb = method.toUpperCase();
  for (const route of compiled) {
    const result = route.regex.exec(pathname);
    if (!result) continue;
    if (route.method !== verb) continue;
    const params = {};
    route.names.forEach((name, index) => {
      params[name] = decodeURIComponent(result[index + 1]);
    });
    return { handler: route.handler, params };
  }
  return null;
}

module.exports = { routes, match, fail };