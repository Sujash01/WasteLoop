/**
 * WasteLoop — data seeding
 *
 * Creates data/*.json on the first run so the portal has something to show.
 * All dates are generated dynamically from the current date (nothing is
 * hard coded), which also keeps the future-date-only booking policy intact.
 */

'use strict';

const store = require('./store');
const dates = require('./dates');
const domain = require('./domain');
const { WASTE_GUIDE } = require('./waste-guide');

const USERS = [
  { id: 'USR-10001', name: 'Aarav Sharma', mobile: '9876500011', email: 'aarav@example.in', city: 'Ludhiana', pincode: '141001', role: 'Citizen', createdAt: null },
  { id: 'USR-10002', name: 'Meera Iyer', mobile: '9876500022', email: 'meera@example.in', city: 'Ludhiana', pincode: '141002', role: 'Citizen', createdAt: null },
  { id: 'USR-10003', name: 'Rohan Verma', mobile: '9876500033', email: 'rohan@example.in', city: 'Ludhiana', pincode: '141003', role: 'Citizen', createdAt: null }
];

/** Historic completed pickups used by the impact dashboard calculations. */
const HISTORIC_COMPLETED = [
  { daysAgo: 21, citizenName: 'Aarav Sharma', mobile: '9876500011', email: 'aarav@example.in', city: 'Ludhiana', pincode: '141001', wasteCategory: 'Plastic Waste', weight: 8, address: 'House No. 22, Model Town' },
  { daysAgo: 17, citizenName: 'Aarav Sharma', mobile: '9876500011', email: 'aarav@example.in', city: 'Ludhiana', pincode: '141001', wasteCategory: 'Paper Waste', weight: 5, address: 'House No. 22, Model Town' },
  { daysAgo: 14, citizenName: 'Aarav Sharma', mobile: '9876500011', email: 'aarav@example.in', city: 'Ludhiana', pincode: '141001', wasteCategory: 'Metal Waste', weight: 3, address: 'House No. 22, Model Town' },
  { daysAgo: 11, citizenName: 'Meera Iyer', mobile: '9876500022', email: 'meera@example.in', city: 'Ludhiana', pincode: '141002', wasteCategory: 'Wet Waste', weight: 6, address: 'Flat 3B, Green Park' },
  { daysAgo: 9, citizenName: 'Rohan Verma', mobile: '9876500033', email: 'rohan@example.in', city: 'Ludhiana', pincode: '141003', wasteCategory: 'E-Waste', weight: 2.5, address: 'Plot 7, Industrial Area' },
  { daysAgo: 6, citizenName: 'Aarav Sharma', mobile: '9876500011', email: 'aarav@example.in', city: 'Ludhiana', pincode: '141001', wasteCategory: 'Glass Waste', weight: 4, address: 'House No. 22, Model Town' },
  { daysAgo: 4, citizenName: 'Meera Iyer', mobile: '9876500022', email: 'meera@example.in', city: 'Ludhiana', pincode: '141002', wasteCategory: 'Plastic Waste', weight: 6.5, address: 'Flat 3B, Green Park' }
];

function isoDaysFromNow(days, now) {
  const base = dates.todayIso(now);
  return dates.addDays(base, days);
}

/** Historical records only (created before today) — allowed to be in the past. */
function buildPickupRecord(plan, index, now) {
  const createdAt = new Date(now.getTime() - plan.daysAgo * 86400000);
  const pickupDate = isoDaysFromNow(-plan.daysAgo, now);
  const collector = domain.pickCollector(plan.wasteCategory + index, index);
  const id = store.buildId('WL', { numberStyle: 'short', now: createdAt });

  return {
    id,
    citizenName: plan.citizenName,
    mobile: plan.mobile,
    email: plan.email,
    address: plan.address,
    city: plan.city,
    pincode: plan.pincode,
    wasteCategory: plan.wasteCategory,
    weight: plan.weight,
    pickupDate,
    remarks: 'Seeded demonstration record.',
    status: 'Completed',
    statusHistory: domain.PICKUP_STATUS_FLOW.map((status, step) => ({
      status,
      at: new Date(createdAt.getTime() + step * 900000).toISOString()
    })),
    collector,
    distanceKm: 0,
    etaMinutes: 0,
    certificateId: null,
    seeded: true,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString()
  };
}

/** One live pickup, booked for tomorrow, waiting to be tracked on the portal. */
function buildLivePickup(now) {
  const pickupDate = isoDaysFromNow(1, now);
  const collector = domain.COLLECTORS[0];
  const id = store.buildId('WL', { numberStyle: 'short', now });
  return {
    id,
    citizenName: 'Aarav Sharma',
    mobile: '9876500011',
    email: 'aarav@example.in',
    address: 'House No. 22, Model Town, Ludhiana',
    city: 'Ludhiana',
    pincode: '141001',
    wasteCategory: 'Plastic Waste',
    weight: 12.5,
    pickupDate,
    remarks: 'Live tracking demonstration pickup.',
    status: 'Collector Assigned',
    statusHistory: [
      { status: 'Collector Assigned', at: new Date(now.getTime() - 240000).toISOString() }
    ],
    collector,
    distanceKm: 4.6,
    etaMinutes: 14,
    certificateId: null,
    seeded: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function buildReward(pickup, pointsPerKg) {
  return {
    id: store.buildId('RWD', { numberStyle: 'short', now: new Date(pickup.createdAt) }),
    pickupId: pickup.id,
    citizenName: pickup.citizenName,
    wasteCategory: pickup.wasteCategory,
    weight: pickup.weight,
    points: Math.round(pickup.weight * pointsPerKg),
    reason: `Green points for completed ${pickup.wasteCategory} pickup`,
    createdAt: pickup.createdAt
  };
}

function buildSampleGrievance(now, pickupId) {
  const createdAt = new Date(now.getTime() - 2 * 86400000).toISOString();
  return {
    id: store.buildId('GRV', { numberStyle: 'year', now: new Date(now.getTime() - 2 * 86400000) }),
    complaintType: 'Pickup Delay',
    pickupId,
    description:
      'Collector arrived more than two hours after the scheduled slot for my sector.',
    citizenName: 'Meera Iyer',
    mobile: '9876500022',
    email: 'meera@example.in',
    contactMethod: 'SMS',
    status: 'Under Review',
    statusHistory: [
      { status: 'Submitted', at: createdAt },
      { status: 'Under Review', at: new Date(now.getTime() - 86400000).toISOString() }
    ],
    reference: store.referenceNumber('GRF'),
    remarks: 'Seeded demonstration grievance.',
    createdAt,
    updatedAt: new Date(now.getTime() - 86400000).toISOString()
  };
}

/**
 * Create every data file that does not exist yet.
 * Existing files are never overwritten, so citizen data is safe between restarts.
 */
async function seedIfEmpty(options = {}) {
  const now = options.now || new Date();
  const summary = { created: [], kept: [] };

  await store.ensureDataDir();

  const users = await store.readCollection('users');
  if (users.length === 0) {
    const rows = USERS.map((user) => ({ ...user, createdAt: now.toISOString() }));
    await store.writeCollection('users', rows);
    summary.created.push('users.json');
  } else {
    summary.kept.push('users.json');
  }

  const requests = await store.readCollection('requests');
  let livePickup = null;
  let pickups = requests;
  if (requests.length === 0) {
    const completed = HISTORIC_COMPLETED.map((plan, index) => buildPickupRecord(plan, index, now));
    livePickup = buildLivePickup(now);
    // Keep the local reference in sync, otherwise the reward seeding below
    // would read the empty array that was loaded before the write.
    pickups = completed.concat([livePickup]);
    await store.writeCollection('requests', pickups);
    summary.created.push('requests.json');
  } else {
    livePickup = requests.find((row) => row.status !== 'Completed') || requests[requests.length - 1];
    summary.kept.push('requests.json');
  }

  const rewards = await store.readCollection('rewards');
  if (rewards.length === 0) {
    const rows = pickups
      .filter((row) => row.status === 'Completed')
      .map((pickup) => buildReward(pickup, domain.GREEN_POINTS_PER_KG[pickup.wasteCategory] ?? 5));
    await store.writeCollection('rewards', rows);
    summary.created.push('rewards.json');
  } else {
    summary.kept.push('rewards.json');
  }

  const grievances = await store.readCollection('grievances');
  if (grievances.length === 0) {
    await store.writeCollection('grievances', [
      buildSampleGrievance(now, livePickup ? livePickup.id : null)
    ]);
    summary.created.push('grievances.json');
  } else {
    summary.kept.push('grievances.json');
  }

  const certificates = await store.readCollection('certificates');
  if (certificates.length === 0) {
    await store.writeCollection('certificates', []);
    summary.created.push('certificates.json');
  } else {
    summary.kept.push('certificates.json');
  }

  return {
    ...summary,
    guideEntries: WASTE_GUIDE.length
  };
}

module.exports = { seedIfEmpty };