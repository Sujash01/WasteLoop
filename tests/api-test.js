/**
 * WasteLoop — API test suite
 *
 * Starts the real server on a throwaway port, exercises every API route with
 * fetch() and checks the results. Run it with:  npm test
 *
 * Core Node.js modules only (http, path, fs) — no test framework.
 *
 * The most important part of this file is the PICKUP DATE VALIDATION section:
 * it proves that yesterday, today, malformed dates and timezone shifts are all
 * rejected by the backend, while tomorrow and later dates are accepted.
 */

'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const PORT = Number(process.env.TEST_PORT) || 4123;
const BASE = 'http://127.0.0.1:' + PORT;

/* ------------------------------------------------------------------
   Tiny test helpers
   ------------------------------------------------------------------ */
let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failed += 1;
    failures.push(name + (detail ? ' -> ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}

function section(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

/** Small fetch wrapper returning { status, body }. */
function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const request = http.request(
      BASE + urlPath,
      {
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch (error) {
            parsed = { raw: raw };
          }
          resolve({ status: response.statusCode, body: parsed });
        });
      }
    );

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

/* ------------------------------------------------------------------
   Date helpers for the tests (independent of lib/dates.js)
   ------------------------------------------------------------------ */
const DAY_MS = 86400000;

function toIso(dayNumber) {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

function todayDayNumber() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/** YYYY-MM-DD -> day number, mirroring lib/dates.js. */
function toDayNumber(value) {
  const parts = String(value).split('-').map(Number);
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / DAY_MS);
}

function validPickupPayload(overrides) {
  return Object.assign(
    {
      citizenName: 'Test Citizen',
      mobile: '9876543210',
      email: 'test@example.com',
      address: 'House No. 1, Test Colony',
      city: 'Ludhiana',
      pincode: '141001',
      wasteCategory: 'Plastic Waste',
      weight: 5,
      pickupDate: toIso(todayDayNumber() + 1), // tomorrow
      remarks: 'API test pickup'
    },
    overrides || {}
  );
}

/* ------------------------------------------------------------------
   Server lifecycle
   ------------------------------------------------------------------ */
function startServer() {
  // Require the server module but do not let it auto-listen; we control the port.
  process.env.PORT = String(PORT);
  const { server, start } = require(path.join(ROOT, 'server.js'));

  return start()
    .then(
      () =>
        new Promise((resolve) => {
          if (server.listening) return resolve(server);
          server.listen(PORT, '127.0.0.1', resolve);
        })
    )
    .then(() => server);
}

async function run() {
  /* ================================================================
     1. GET /api/meta
     ================================================================ */
  section('1. GET /api/meta');
  const meta = await api('GET', '/api/meta');
  check('returns 200', meta.status === 200, 'status ' + meta.status);
  check('ok === true', meta.body && meta.body.ok === true);
  check(
    'minimumPickupDate is tomorrow',
    meta.body.minimumPickupDate === toIso(todayDayNumber() + 1),
    'got ' + (meta.body && meta.body.minimumPickupDate)
  );
  check(
    'serverDate is today',
    meta.body.serverDate === toIso(todayDayNumber()),
    'got ' + (meta.body && meta.body.serverDate)
  );
  check('waste categories provided', Array.isArray(meta.body.wasteCategories) && meta.body.wasteCategories.length > 0);
  check('complaint types provided', Array.isArray(meta.body.complaintTypes) && meta.body.complaintTypes.length === 6);
  check('contact methods provided', Array.isArray(meta.body.contactMethods) && meta.body.contactMethods.length > 0);
  check('pickup status flow provided', Array.isArray(meta.body.pickupStatusFlow) && meta.body.pickupStatusFlow.length === 5);
  check('grievance status flow provided', Array.isArray(meta.body.grievanceStatusFlow) && meta.body.grievanceStatusFlow.length === 4);
  check('collectors provided', Array.isArray(meta.body.collectors) && meta.body.collectors.length > 0);

  // /api/meta?tz= must return the minimum that POST /api/pickups will accept
  // from that same caller, so the browser calendar can never disagree with the
  // server policy. Offsets follow Date.getTimezoneOffset() (India = -330).
  const metaNoTz = await api('GET', '/api/meta');
  check(
    'meta without tz reports its own minimum',
    metaNoTz.body.minimumPickupDate === metaNoTz.body.serverMinimumPickupDate,
    'got ' + metaNoTz.body.minimumPickupDate + ' vs ' + metaNoTz.body.serverMinimumPickupDate
  );
  check('meta without tz does not claim an offset was applied', metaNoTz.body.clientOffsetApplied === false);

  const indiaMeta = await api('GET', '/api/meta?tz=-330');
  check('meta with tz marks the offset as applied', indiaMeta.body.clientOffsetApplied === true);
  check(
    'meta with tz still reports the server own minimum separately',
    indiaMeta.body.serverMinimumPickupDate === metaNoTz.body.serverMinimumPickupDate,
    'got ' + indiaMeta.body.serverMinimumPickupDate
  );

  // A visitor 13 hours ahead of the server clock can legitimately be on the
  // next calendar day, so their minimum is one day earlier.
  const ahead = await api('GET', '/api/meta?tz=780');
  check(
    'offset-aware minimum is never later than the server minimum',
    toDayNumber(ahead.body.minimumPickupDate) <= toDayNumber(ahead.body.serverMinimumPickupDate),
    'got ' + ahead.body.minimumPickupDate + ' vs ' + ahead.body.serverMinimumPickupDate
  );

  // The minimum returned for a caller must be exactly what that caller may book.
  for (const tz of ['-330', '780', '-780']) {
    const callerMeta = await api('GET', '/api/meta?tz=' + tz);
    const minDay = toDayNumber(callerMeta.body.minimumPickupDate);
    const atMin = await api('POST', '/api/pickups', validPickupPayload({
      pickupDate: toIso(minDay),
      clientTimezoneOffset: Number(tz)
    }));
    const beforeMin = await api('POST', '/api/pickups', validPickupPayload({
      pickupDate: toIso(minDay - 1),
      clientTimezoneOffset: Number(tz)
    }));
    check(
      'tz=' + tz + ' accepts its own reported minimum ' + callerMeta.body.minimumPickupDate,
      atMin.status === 200,
      'status ' + atMin.status
    );
    check(
      'tz=' + tz + ' rejects the day before its own reported minimum',
      beforeMin.status === 400 &&
        beforeMin.body.error.code === 'INVALID_PICKUP_DATE',
      'status ' + beforeMin.status
    );
  }

  /* ================================================================
     2. POST /api/pickups — the CRITICAL date validation
     ================================================================ */
  section('2. POST /api/pickups — pickup date validation');

  const yesterday = await api('POST', '/api/pickups', validPickupPayload({
    pickupDate: toIso(todayDayNumber() - 1)
  }));
  check('yesterday is REJECTED', yesterday.status === 400, 'status ' + yesterday.status);
  check(
    'yesterday error code is INVALID_PICKUP_DATE',
    yesterday.body.error && yesterday.body.error.code === 'INVALID_PICKUP_DATE',
    JSON.stringify(yesterday.body.error)
  );
  check(
    'yesterday message matches the required wording',
    yesterday.body.error && yesterday.body.error.message ===
      'Pickup date must be a future date. Please select tomorrow or a later date.',
    yesterday.body.error && yesterday.body.error.message
  );
  check('error field is pickupDate', yesterday.body.error && yesterday.body.error.field === 'pickupDate');

  const today = await api('POST', '/api/pickups', validPickupPayload({
    pickupDate: toIso(todayDayNumber())
  }));
  check('today is REJECTED', today.status === 400, 'status ' + today.status);
  check(
    'today error code is INVALID_PICKUP_DATE',
    today.body.error && today.body.error.code === 'INVALID_PICKUP_DATE'
  );

  const farPast = await api('POST', '/api/pickups', validPickupPayload({
    pickupDate: toIso(todayDayNumber() - 365)
  }));
  check('a year ago is REJECTED', farPast.status === 400, 'status ' + farPast.status);

  const impossible = await api('POST', '/api/pickups', validPickupPayload({ pickupDate: '2026-02-31' }));
  check('impossible calendar date 2026-02-31 is REJECTED', impossible.status === 400, 'status ' + impossible.status);

  const badFormat = await api('POST', '/api/pickups', validPickupPayload({ pickupDate: '06-10-2026' }));
  check('wrong format 06-10-2026 is REJECTED', badFormat.status === 400, 'status ' + badFormat.status);

  const noDate = await api('POST', '/api/pickups', validPickupPayload({ pickupDate: '' }));
  check('missing pickup date is REJECTED', noDate.status === 400, 'status ' + noDate.status);

  // Timezone edge case: a browser in UTC+13 (offset -780) whose local
  // "tomorrow" must still be accepted, and "today" still rejected.
  const tzTomorrow = await api('POST', '/api/pickups', validPickupPayload({
    pickupDate: toIso(todayDayNumber() + 1),
    clientTimezoneOffset: -780
  }));
  check('tomorrow accepted for a UTC+13 client', tzTomorrow.status === 200, 'status ' + tzTomorrow.status);

  const tzToday = await api('POST', '/api/pickups', validPickupPayload({
    pickupDate: toIso(todayDayNumber()),
    clientTimezoneOffset: -780
  }));
  check('today rejected even for a UTC+13 client', tzToday.status === 400, 'status ' + tzToday.status);

  const tomorrow = await api('POST', '/api/pickups', validPickupPayload());
  check('tomorrow is ACCEPTED', tomorrow.status === 200, 'status ' + tomorrow.status);
  check('response has a pickup id', !!(tomorrow.body.pickup && tomorrow.body.pickup.id));
  check(
    'pickup id looks like WL20491',
    /^WL\d{5}$/.test(tomorrow.body.pickup.id),
    tomorrow.body.pickup.id
  );
  check('pickup date is stored as sent', tomorrow.body.pickup.pickupDate === toIso(todayDayNumber() + 1));
  check(
    'collector was auto-assigned via the event bus',
    !!(tomorrow.body.pickup.collector && tomorrow.body.pickup.collector.name),
    'collector: ' + JSON.stringify(tomorrow.body.pickup.collector)
  );
  check(
    'status advanced to Collector Assigned',
    tomorrow.body.pickup.status === 'Collector Assigned',
    tomorrow.body.pickup.status
  );
  check('distance was computed', typeof tomorrow.body.pickup.distanceKm === 'number');
  check('eta was computed', typeof tomorrow.body.pickup.etaMinutes === 'number');

  const nextWeek = await api('POST', '/api/pickups', validPickupPayload({
    pickupDate: toIso(todayDayNumber() + 7)
  }));
  check('a date one week ahead is ACCEPTED', nextWeek.status === 200, 'status ' + nextWeek.status);

  /* ================================================================
     3. Field validation on POST /api/pickups
     ================================================================ */
  section('3. POST /api/pickups — field validation');
  const badMobile = await api('POST', '/api/pickups', validPickupPayload({ mobile: '12345' }));
  check('invalid mobile rejected', badMobile.status === 400);
  const badEmail = await api('POST', '/api/pickups', validPickupPayload({ email: 'not-an-email' }));
  check('invalid email rejected', badEmail.status === 400);
  const badCategory = await api('POST', '/api/pickups', validPickupPayload({ wasteCategory: 'Unobtainium' }));
  check('unknown waste category rejected', badCategory.status === 400);
  const badWeight = await api('POST', '/api/pickups', validPickupPayload({ weight: 0 }));
  check('zero weight rejected', badWeight.status === 400);
  const badPincode = await api('POST', '/api/pickups', validPickupPayload({ pincode: '123' }));
  check('invalid pincode rejected', badPincode.status === 400);
  const missingName = await api('POST', '/api/pickups', validPickupPayload({ citizenName: '' }));
  check('missing citizen name rejected', missingName.status === 400);

  /* ================================================================
     4. GET /api/pickups and GET /api/pickups/:id
     ================================================================ */
  section('4. GET /api/pickups');
  const list = await api('GET', '/api/pickups');
  check('returns 200', list.status === 200);
  check('returns an array', Array.isArray(list.body.pickups));
  check('count matches', list.body.count === list.body.pickups.length);
  check(
    'newest pickup is first (sorted by createdAt desc)',
    list.body.pickups.length === 0 || list.body.pickups[0].id === nextWeek.body.pickup.id,
    'first: ' + (list.body.pickups[0] && list.body.pickups[0].id)
  );

  const filtered = await api('GET', '/api/pickups?status=Collector%20Assigned');
  check('status filter works', filtered.body.pickups.every((p) => p.status === 'Collector Assigned'));

  const single = await api('GET', '/api/pickups/' + tomorrow.body.pickup.id);
  check('single pickup returns 200', single.status === 200);
  check('pickup id matches', single.body.pickup.id === tomorrow.body.pickup.id);
  check('status history recorded', Array.isArray(single.body.pickup.statusHistory) && single.body.pickup.statusHistory.length >= 2);

  const missing = await api('GET', '/api/pickups/WL000000');
  check('unknown pickup returns 404', missing.status === 404, 'status ' + missing.status);
  /* ================================================================
     5. Pickup status flow + certificate gating
     ================================================================ */
  section('5. Pickup status flow (live tracking simulation)');
  const pickupId = tomorrow.body.pickup.id;

  // Certificate must be refused before completion.
  const earlyCert = await api('POST', '/api/certificates', { pickupId: pickupId });
  check('certificate refused while not Completed', earlyCert.status === 409, 'status ' + earlyCert.status);
  check(
    'refusal explains the Completed requirement',
    /Completed/.test(earlyCert.body.error.message),
    earlyCert.body.error.message
  );

  const flow = ['On the Way', 'Arriving', 'Collected', 'Completed'];
  let flowOk = true;
  for (const status of flow) {
    const res = await api('POST', '/api/pickups/' + pickupId + '/status', { status: status });
    if (res.status !== 200 || res.body.pickup.status !== status) {
      flowOk = false;
      check('status -> ' + status, false, 'status ' + res.status + ' body ' + JSON.stringify(res.body.pickup && res.body.pickup.status));
    }
  }
  check('status advances through the whole flow', flowOk);

  const backwards = await api('POST', '/api/pickups/' + pickupId + '/status', { status: 'On the Way' });
  check('status cannot move backwards', backwards.status === 409, 'status ' + backwards.status);

  const invalidStatus = await api('POST', '/api/pickups/' + pickupId + '/status', { status: 'Teleported' });
  check('unknown status rejected', invalidStatus.status === 400);

  const completed = await api('GET', '/api/pickups/' + pickupId);
  check('pickup is now Completed', completed.body.pickup.status === 'Completed');
  check('distance reset to 0 on completion', completed.body.pickup.distanceKm === 0);
  check('eta reset to 0 on completion', completed.body.pickup.etaMinutes === 0);

  /* ================================================================
     6. Green points reward (rewardGenerated event)
     ================================================================ */
  section('6. Green points reward');
  const impactAfter = await api('GET', '/api/impact');
  const plasticPoints = impactAfter.body.impact.totals.greenPoints;
  check('green points total is positive', plasticPoints > 0, 'points ' + plasticPoints);

  const rewardsFile = JSON.parse(await fsp.readFile(path.join(DATA_DIR, 'rewards.json'), 'utf8'));
  check(
    'rewards.json has a row for the completed pickup',
    rewardsFile.some((row) => row.pickupId === pickupId)
  );
  const reward = rewardsFile.find((row) => row.pickupId === pickupId);
  check('reward points = weight x category rate (5 kg x 8 = 40)', reward && reward.points === 40, reward && String(reward.points));

  /* ================================================================
     7. GET /api/impact — calculated, not hard coded
     ================================================================ */
  section('7. GET /api/impact — environmental calculations');
  const impact = await api('GET', '/api/impact');
  check('returns 200', impact.status === 200);
  check('has totals', !!impact.body.impact.totals);
  check('totalWasteKg is a number', typeof impact.body.impact.totals.totalWasteKg === 'number');
  check('totalWasteKg > 0', impact.body.impact.totals.totalWasteKg > 0);
  check('plasticDiverted is a number', typeof impact.body.impact.totals.plasticDiverted === 'number');
  check('paperRecycled is a number', typeof impact.body.impact.totals.paperRecycled === 'number');
  check('co2SavedKg is a number', typeof impact.body.impact.totals.co2SavedKg === 'number');
  check('completedPickups counted', impact.body.impact.totals.completedPickups > 0);
  check('categoryBreakdown present', Array.isArray(impact.body.impact.categoryBreakdown) && impact.body.impact.categoryBreakdown.length > 0);
  check('methodology note present', typeof impact.body.impact.methodology === 'string' && impact.body.impact.methodology.length > 20);

  // Recompute independently and compare — proves the maths is real.
  const breakdownSum = impact.body.impact.categoryBreakdown.reduce((sum, row) => sum + row.weightKg, 0);
  check(
    'sum of category breakdown equals totalWasteKg',
    Math.abs(breakdownSum - impact.body.impact.totals.totalWasteKg) < 0.05,
    breakdownSum + ' vs ' + impact.body.impact.totals.totalWasteKg
  );
  const co2Sum = impact.body.impact.categoryBreakdown.reduce((sum, row) => sum + row.co2SavedKg, 0);
  check(
    'sum of per-category CO2 equals total CO2 saved',
    Math.abs(co2Sum - impact.body.impact.totals.co2SavedKg) < 0.05,
    co2Sum + ' vs ' + impact.body.impact.totals.co2SavedKg
  );
  check(
    'breakdown sorted by weight descending',
    impact.body.impact.categoryBreakdown.every(
      (row, i, arr) => i === 0 || arr[i - 1].weightKg >= row.weightKg
    )
  );

  /* ================================================================
     8. GET /api/waste-guide — Smart Waste Disposal Guide
     ================================================================ */
  section('8. GET /api/waste-guide — smart waste guide');
  const all = await api('GET', '/api/waste-guide');
  check('returns all entries when no query', all.body.items.length >= 10, 'items ' + all.body.items.length);

  const phone = await api('GET', '/api/waste-guide?q=phone');
  check('partial search "phone" finds Mobile Phone',
    phone.body.items.some((i) => i.id === 'mobile-phone'),
    JSON.stringify(phone.body.items.map((i) => i.item))
  );

  const oldPhone = await api('GET', '/api/waste-guide?q=old%20mobile');
  check('search "old mobile" finds Mobile Phone',
    oldPhone.body.items.some((i) => i.id === 'mobile-phone'));

  const bottle = await api('GET', '/api/waste-guide?q=bottle');
  check('search "bottle" finds plastic + glass bottles',
    bottle.body.items.length >= 2,
    'items ' + bottle.body.items.length
  );

  const newspaper = await api('GET', '/api/waste-guide?q=newspaper');
  const newspaperEntry = newspaper.body.items.find((i) => i.id === 'newspaper');
  check('newspaper entry found', !!newspaperEntry);
  check('has wasteType', !!(newspaperEntry && newspaperEntry.wasteType));
  check('has recyclable flag', newspaperEntry && typeof newspaperEntry.recyclable === 'boolean');
  check('has recommendedAction', !!(newspaperEntry && newspaperEntry.recommendedAction));
  check('has greenPointsPerKg', newspaperEntry && typeof newspaperEntry.greenPointsPerKg === 'number');
  check('has warning', !!(newspaperEntry && newspaperEntry.warning));

  const battery = await api('GET', '/api/waste-guide?q=battery');
  const batteryEntry = battery.body.items.find((i) => i.id === 'battery');
  check('battery is marked not recyclable', batteryEntry && batteryEntry.recyclable === false);

  const nothing = await api('GET', '/api/waste-guide?q=zzzzqqq');
  check('unknown search returns 0 items (frontend shows "No matching waste type found")',
    nothing.body.items.length === 0 && nothing.body.count === 0);

  /* ================================================================
     9. POST /api/grievances + status flow
     ================================================================ */
  section('9. Grievance portal');
  const grievance = await api('POST', '/api/grievances', {
    citizenName: 'Test Citizen',
    complaintType: 'Pickup Delay',
    pickupId: pickupId,
    description: 'The collector arrived almost three hours after the allotted slot today.',
    mobile: '9876543210',
    email: 'test@example.com',
    contactMethod: 'SMS'
  });
  check('grievance created (200)', grievance.status === 200, 'status ' + grievance.status);
  check(
    'grievance id format is GRV-2026-10482',
    /^GRV-\d{4}-\d{5}$/.test(grievance.body.grievance.id),
    grievance.body.grievance && grievance.body.grievance.id
  );
  check('initial status is Submitted', grievance.body.grievance.status === 'Submitted');
  check('reference number generated', /^GRF-/.test(grievance.body.grievance.reference));
  check('status history seeded', grievance.body.grievance.statusHistory.length === 1);

  const grievanceId = grievance.body.grievance.id;

  const grievanceList = await api('GET', '/api/grievances');
  check('grievance list returns 200', grievanceList.status === 200);
  check('grievance appears in the list', grievanceList.body.grievances.some((g) => g.id === grievanceId));

  const grievanceGet = await api('GET', '/api/grievances/' + grievanceId);
  check('grievance tracking returns 200', grievanceGet.status === 200);
  check('status flow returned', Array.isArray(grievanceGet.body.grievance.statusFlow) && grievanceGet.body.grievance.statusFlow.length === 4);
  check('next status is Under Review', grievanceGet.body.grievance.nextStatus === 'Under Review');

  let grievanceFlowOk = true;
  for (const status of ['Under Review', 'Assigned', 'Resolved']) {
    const res = await api('POST', '/api/grievances/' + grievanceId + '/status', { status: status });
    if (res.status !== 200 || res.body.grievance.status !== status) {
      grievanceFlowOk = false;
      check('grievance -> ' + status, false, 'status ' + res.status);
    }
  }
  check('grievance advances Submitted -> Resolved', grievanceFlowOk);

  const grievanceBack = await api('POST', '/api/grievances/' + grievanceId + '/status', { status: 'Submitted' });
  check('grievance status cannot move backwards', grievanceBack.status === 409);

  const badType = await api('POST', '/api/grievances', {
    citizenName: 'Test Citizen',
    complaintType: 'Unhappy About Everything',
    description: 'A description long enough to pass the length check.',
    mobile: '9876543210',
    contactMethod: 'SMS'
  });
  check('unknown complaint type rejected', badType.status === 400);

  const shortDesc = await api('POST', '/api/grievances', {
    citizenName: 'Test Citizen',
    complaintType: 'Other',
    description: 'too short',
    mobile: '9876543210',
    contactMethod: 'SMS'
  });
  check('short description rejected', shortDesc.status === 400);

  const badContact = await api('POST', '/api/grievances', {
    citizenName: 'Test Citizen',
    complaintType: 'Other',
    description: 'A description long enough to pass the length check.',
    mobile: '9876543210',
    contactMethod: 'Carrier Pigeon'
  });
  check('unknown contact method rejected', badContact.status === 400);

  const badPickupRef = await api('POST', '/api/grievances', {
    citizenName: 'Test Citizen',
    complaintType: 'Other',
    pickupId: 'WL999999',
    description: 'A description long enough to pass the length check.',
    mobile: '9876543210',
    contactMethod: 'SMS'
  });
  check('unknown pickup reference rejected', badPickupRef.status === 400);

  const missingGrievance = await api('GET', '/api/grievances/GRV-1999-000000');
  check('unknown grievance returns 404', missingGrievance.status === 404);

  /* ================================================================
     10. Digital recycling certificate
     ================================================================ */
  section('10. Digital recycling certificate');
  const cert = await api('POST', '/api/certificates', { pickupId: pickupId });
  check('certificate generated (200)', cert.status === 200, 'status ' + cert.status);
  check(
    'certificate id format is WL-CERT-92841',
    /^WL-CERT-\d{5}$/.test(cert.body.certificate.id),
    cert.body.certificate && cert.body.certificate.id
  );
  check('certificate records the pickup id', cert.body.certificate.pickupId === pickupId);
  check('certificate records the citizen name', cert.body.certificate.citizenName === 'Test Citizen');
  check('certificate records the waste category', cert.body.certificate.wasteCategory === 'Plastic Waste');
  check('certificate records the weight', cert.body.certificate.weight === 5);
  check('certificate has a recycling centre', !!cert.body.certificate.recyclingCentre);
  check('certificate has a verification number', /^WLREF-/.test(cert.body.certificate.verificationNumber));
  check('certificate has an issue date', /^\d{4}-\d{2}-\d{2}$/.test(cert.body.certificate.issuedOn));
  check('certificate has a long-form issue date', /\d{4}$/.test(cert.body.certificate.issueDateLong || ''));
  check('certificate carries the prototype disclaimer', /prototype/i.test(cert.body.certificate.note || ''));

  const certAgain = await api('POST', '/api/certificates', { pickupId: pickupId });
  check('regenerating returns the same certificate (idempotent)',
    certAgain.body.certificate.id === cert.body.certificate.id);

  const certId = cert.body.certificate.id;

  const certGet = await api('GET', '/api/certificates/' + certId);
  check('GET /api/certificates/:id returns 200', certGet.status === 200);
  check('certificate lookup by id works', certGet.body.certificate.id === certId);
  check('certificate includes the linked pickup', !!certGet.body.certificate.pickup);
  check('pickup has a long-form date', /\d{4}$/.test(certGet.body.certificate.pickup.pickupDateLong || ''));

  const certList = await api('GET', '/api/certificates');
  check('certificate list returns 200', certList.status === 200);
  check('issued certificate is listed', certList.body.certificates.some((c) => c.id === certId));
  check('eligible completed pickups listed', Array.isArray(certList.body.eligible));

  const missingCert = await api('GET', '/api/certificates/WL-CERT-000000');
  check('unknown certificate returns 404', missingCert.status === 404);

  const pickupWithCert = await api('GET', '/api/pickups/' + pickupId);
  check('pickup now carries the certificate id', pickupWithCert.body.pickup.certificateId === certId);

  /* ================================================================
     11. Error handling
     ================================================================ */
  section('11. Error handling');
  const badRoute = await api('GET', '/api/does-not-exist');
  check('unknown API route returns 404', badRoute.status === 404);
  check('unknown API route returns ok:false', badRoute.body.ok === false);

  const badMethod = await api('DELETE', '/api/pickups');
  check('unsupported method returns 404', badMethod.status === 404);

  const malformed = await new Promise((resolve) => {
    const request = http.request(
      BASE + '/api/pickups',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (response) => {
        let raw = '';
        response.on('data', (c) => (raw += c));
        response.on('end', () => resolve({ status: response.statusCode, raw: raw }));
      }
    );
    request.write('{ this is not json');
    request.end();
  });
  check('malformed JSON body returns 400', malformed.status === 400, 'status ' + malformed.status);

  /* ================================================================
     12. Static file serving
     ================================================================ */
  section('12. Static file serving');
  const pages = [
    '/',
    '/index.html',
    '/pages/pickup.html',
    '/pages/track.html',
    '/pages/waste-guide.html',
    '/pages/dashboard.html',
    '/pages/grievance.html',
    '/pages/certificate.html',
    '/js/api.js',
    '/js/dates.js',
    '/js/track.js',
    '/css/portal.css'
  ];
  for (const page of pages) {
    const res = await api('GET', page);
    check('serves ' + page, res.status === 200, 'status ' + res.status);
  }

  // A URL parser collapses "../" in a plain path, so the interesting case is a
  // percent-encoded traversal that survives normalisation and only gets decoded
  // inside serveStatic. That must be refused, not served.
  const encodedTraversal = await api('GET', '/%2e%2e%2f%2e%2e%2fpackage.json');
  check('encoded path traversal is refused', encodedTraversal.status === 403, 'status ' + encodedTraversal.status);
  check(
    'traversal response is a JSON error, not file content',
    encodedTraversal.body && encodedTraversal.body.ok === false
  );

  const encodedTraversal2 = await api('GET', '/pages/%2e%2e%2f%2e%2e%2f%2e%2e%2fserver.js');
  check('encoded traversal from a subfolder is refused', encodedTraversal2.status === 403, 'status ' + encodedTraversal2.status);
}

function report() {
  console.log('\n' + '='.repeat(52));
  console.log('  RESULT: ' + passed + ' passed, ' + failed + ' failed');
  console.log('='.repeat(52));

  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  - ' + f));
  }
  console.log('');
  return failed === 0;
}

startServer()
  .then((server) =>
    run()
      .then(() => report())
      .catch((error) => {
        console.error('\nTest run crashed:', error);
        failed += 1;
        report();
      })
      .then((ok) => {
        server.close();
        process.exit(ok ? 0 : 1);
      })
  )
  .catch((error) => {
    console.error('Could not start the server:', error);
    process.exit(1);
  });
