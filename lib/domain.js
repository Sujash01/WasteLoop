/**
 * WasteLoop — domain logic (collector assignment, status flow, impact maths,
 * certificates and green points). No framework, no database — plain functions
 * operating on JSON objects.
 */

'use strict';

const store = require('./store');
const dates = require('./dates');
const { emit } = require('./events');

/** Simulated municipal collector fleet (mock data for the tracking demo). */
const COLLECTORS = [
  { name: 'Raj Kumar', vehicle: 'PB10 AB 1234', rating: 4.8, phone: '98765-43210', zone: 'Ludhiana North' },
  { name: 'Sunita Devi', vehicle: 'PB10 CD 5678', rating: 4.9, phone: '98765-43211', zone: 'Ludhiana South' },
  { name: 'Manpreet Singh', vehicle: 'PB10 EF 9012', rating: 4.7, phone: '98765-43212', zone: 'Ludhiana East' },
  { name: 'Arun Lal', vehicle: 'PB10 GH 3456', rating: 4.6, phone: '98765-43213', zone: 'Ludhiana West' }
];

/** Live pickup status flow used by the tracking page and the API. */
const PICKUP_STATUS_FLOW = [
  'Collector Assigned',
  'On the Way',
  'Arriving',
  'Collected',
  'Completed'
];

const GRIEVANCE_STATUS_FLOW = ['Submitted', 'Under Review', 'Assigned', 'Resolved'];

/** Recycling centres shown on the certificate. */
const RECYCLING_CENTRES = [
  'WasteLoop Integrated Recycling Facility, Ludhiana',
  'Municipal Solid Waste Recovery Centre, Sector 7',
  'Urban Local Body Compost & Recovery Plant'
];

/**
 * Illustrative CO2 saving factors in kg CO2e avoided per kg of material diverted
 * from landfill. Used only for the academic prototype dashboard.
 */
const CO2_FACTORS = {
  'Plastic Waste': 2.3,
  'Paper Waste': 1.1,
  'Metal Waste': 4.0,
  'Glass Waste': 0.85,
  'E-Waste': 5.5,
  'Wet / Organic Waste': 0.42,
  'Wet Waste': 0.42,
  'Dry Waste': 0.6,
  'Hazardous Waste': 1.2
};

/** Green points per kg, aligned with the Smart Waste Disposal Guide. */
const GREEN_POINTS_PER_KG = {
  'Plastic Waste': 8,
  'Paper Waste': 12,
  'Metal Waste': 45,
  'Glass Waste': 5,
  'E-Waste': 22,
  'Wet Waste': 3,
  'Dry Waste': 5,
  'Hazardous Waste': 0
};

/** Pick a collector deterministically from the pickup id. */
function pickCollector(pickupId, index = 0) {
  const seed = String(pickupId).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), index);
  return { ...COLLECTORS[seed % COLLECTORS.length] };
}

function stamp(status, at) {
  return { status, at: at || new Date().toISOString() };
}

/**
 * Assign a collector to a newly created pickup.
 * Called from the pickupRequested event listener (see lib/workflows.js).
 */
async function assignCollector(pickup) {
  const collector = pickCollector(pickup.id, pickup.mobile ? pickup.mobile.length : 0);
  const distanceKm = Number((1.2 + (collector.rating % 1) * 3).toFixed(2));
  const etaMinutes = Math.max(4, Math.round(distanceKm * 4.5));

  const updated = await store.updateRecord('requests', pickup.id, (row) => ({
    ...row,
    collector,
    status: PICKUP_STATUS_FLOW[0],
    statusHistory: [...(row.statusHistory || []), stamp(PICKUP_STATUS_FLOW[0])],
    distanceKm,
    etaMinutes,
    updatedAt: new Date().toISOString()
  }));

  if (updated) {
    emit('pickupAssigned', { pickupId: updated.id, collector: updated.collector.name, vehicle: updated.collector.vehicle });
  }
  return updated;
}

/** Valid, in-flow status change. Completed status also awards green points. */
async function updatePickupStatus(pickup, nextStatus, options = {}) {
  if (!PICKUP_STATUS_FLOW.includes(nextStatus)) {
    const error = new Error('Unknown pickup status: ' + nextStatus);
    error.statusCode = 400;
    error.code = 'INVALID_STATUS';
    throw error;
  }

  const updated = await store.updateRecord('requests', pickup.id, (row) => ({
    ...row,
    status: nextStatus,
    statusHistory: [...(row.statusHistory || []), stamp(nextStatus)],
    distanceKm: nextStatus === 'Completed' ? 0 : row.distanceKm,
    etaMinutes: nextStatus === 'Completed' ? 0 : row.etaMinutes,
    updatedAt: new Date().toISOString()
  }));

  if (nextStatus === 'Completed' && updated) {
    emit('pickupCompleted', { pickupId: updated.id, weight: updated.weight, category: updated.wasteCategory });
    await awardGreenPoints(updated);
  }
  return updated;
}

/**
 * Green points reward for a completed pickup.
 * The rewardGenerated event fires only when the pickup has not been rewarded yet.
 */
async function awardGreenPoints(pickup) {
  const rewards = await store.readCollection('rewards');
  const existing = rewards.find((row) => row.pickupId === pickup.id);
  if (existing) return existing;

  const perKg = GREEN_POINTS_PER_KG[pickup.wasteCategory] ?? 5;
  const points = Math.round(Number(pickup.weight || 0) * perKg);
  const reward = {
    id: store.buildId('RWD', { numberStyle: 'short' }),
    pickupId: pickup.id,
    citizenName: pickup.citizenName,
    wasteCategory: pickup.wasteCategory,
    weight: Number(pickup.weight || 0),
    points,
    reason: `Green points for completed ${pickup.wasteCategory} pickup`,
    createdAt: new Date().toISOString()
  };

  await store.insertRecord('rewards', reward);
  emit('rewardGenerated', { pickupId: pickup.id, points });
  return reward;
}

/** Issue a digital recycling certificate. Only allowed for completed pickups. */
async function generateCertificate(pickup, options = {}) {
  if (!pickup) {
    const error = new Error('Pickup request not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (pickup.status !== 'Completed') {
    const error = new Error(
      'Certificate can only be generated once the pickup status is Completed. ' +
        'Current status: ' + pickup.status + '.'
    );
    error.statusCode = 409;
    error.code = 'PICKUP_NOT_COMPLETED';
    throw error;
  }

  const certificates = await store.readCollection('certificates');
  const existing = certificates.find((row) => row.pickupId === pickup.id);
  if (existing) return existing;

  const reward = (await store.readCollection('rewards')).find((row) => row.pickupId === pickup.id);
  const centreIndex =
    String(pickup.id).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) %
    RECYCLING_CENTRES.length;

  const certificate = {
    id: store.buildId('WL-CERT', { numberStyle: 'short' }),
    pickupId: pickup.id,
    citizenName: pickup.citizenName,
    city: pickup.city,
    wasteCategory: pickup.wasteCategory,
    weight: Number(pickup.weight || 0),
    greenPoints: reward ? reward.points : 0,
    recyclingCentre: RECYCLING_CENTRES[centreIndex],
    verificationNumber: store.referenceNumber('WLREF'),
    issuedOn: dates.todayIso(options.now),
    issuedAt: new Date().toISOString(),
    status: 'Issued',
    note: 'Academic prototype certificate. Not a legal document and not issued by any government authority.'
  };

  await store.insertRecord('certificates', certificate);
  await store.updateRecord('requests', pickup.id, (row) => ({
    ...row,
    certificateId: certificate.id,
    updatedAt: new Date().toISOString()
  }));
  emit('certificateGenerated', { certificateId: certificate.id, pickupId: pickup.id, citizen: certificate.citizenName });
  return certificate;
}

/**
 * Environmental impact report, calculated from stored pickup records.
 * Nothing here is hard coded in the UI — the dashboard renders whatever this
 * function computes.
 */
async function computeImpact(options = {}) {
  const requests = await store.readCollection('requests');
  const rewards = await store.readCollection('rewards');
  const certificates = await store.readCollection('certificates');

  const completed = requests.filter((row) => row.status === 'Completed');

  // Category totals use reduce() over the completed pickups.
  const byCategory = completed.reduce((totals, pickup) => {
    const category = pickup.wasteCategory;
    const weight = Number(pickup.weight || 0);
    totals.total += weight;
    totals[category] = (totals[category] || 0) + weight;
    return totals;
  }, { total: 0 });

  const totalWasteKg = Number(byCategory.total.toFixed(2));
  const plasticDiverted = Number((byCategory['Plastic Waste'] || 0).toFixed(2));
  const paperRecycled = Number((byCategory['Paper Waste'] || 0).toFixed(2));
  const metalRecycled = Number((byCategory['Metal Waste'] || 0).toFixed(2));
  const glassRecycled = Number((byCategory['Glass Waste'] || 0).toFixed(2));
  const ewasteRecovered = Number((byCategory['E-Waste'] || 0).toFixed(2));

  // CO2 saved = sum(weight x factor) over the completed pickups.
  const co2Saved = completed.reduce((sum, pickup) => {
    const factor = CO2_FACTORS[pickup.wasteCategory] ?? 0.6;
    return sum + Number(pickup.weight || 0) * factor;
  }, 0);

  const categoryBreakdown = Object.entries(byCategory)
    .filter(([category]) => category !== 'total')
    .map(([category, weight]) => ({
      category,
      weightKg: Number(weight.toFixed(2)),
      co2Factor: CO2_FACTORS[category] ?? 0.6,
      co2SavedKg: Number((weight * (CO2_FACTORS[category] ?? 0.6)).toFixed(2))
    }))
    .sort((a, b) => b.weightKg - a.weightKg);

  const greenPoints = rewards.reduce((sum, reward) => sum + Number(reward.points || 0), 0);

  const sortedPickups = [...requests].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      totalWasteKg,
      plasticDiverted,
      paperRecycled,
      metalRecycled,
      glassRecycled,
      ewasteRecovered,
      co2SavedKg: Number(co2Saved.toFixed(2)),
      completedPickups: completed.length,
      totalPickups: requests.length,
      pendingPickups: requests.filter((row) => row.status !== 'Completed').length,
      greenPoints,
      certificatesIssued: certificates.length,
      activeCollectors: new Set(
        requests.filter((row) => row.collector).map((row) => row.collector.name)
      ).size
    },
    categoryBreakdown,
    co2Factors: CO2_FACTORS,
    methodology:
      'Totals are calculated from stored pickup records (data/requests.json). ' +
      'CO2 saving = weight diverted x material factor (illustrative values, ' +
      'academic prototype — not an official measurement).',
    recentPickups: sortedPickups.slice(0, Number(options.limit) || 8).map((pickup) => ({
      id: pickup.id,
      citizenName: pickup.citizenName,
      wasteCategory: pickup.wasteCategory,
      weight: Number(pickup.weight || 0),
      status: pickup.status,
      pickupDate: pickup.pickupDate,
      certificateId: pickup.certificateId || null
    }))
  };
}

module.exports = {
  COLLECTORS,
  PICKUP_STATUS_FLOW,
  GRIEVANCE_STATUS_FLOW,
  RECYCLING_CENTRES,
  CO2_FACTORS,
  GREEN_POINTS_PER_KG,
  assignCollector,
  updatePickupStatus,
  awardGreenPoints,
  generateCertificate,
  computeImpact,
  pickCollector
};