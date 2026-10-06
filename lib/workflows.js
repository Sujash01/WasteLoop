/**
 * WasteLoop — event driven workflows
 *
 * The API handlers only "emit" events; the actual reactions live here.
 * Adding a listener is all that is needed to extend the pickup lifecycle.
 *
 *   pickupRequested  -> save already done -> assign collector + status
 *   pickupAssigned   -> log the allocation
 *   pickupCompleted  -> (handled in domain) -> green points reward
 *   grievanceSubmitted -> open the redressal ticket
 *   certificateGenerated / rewardGenerated -> notifications
 */

'use strict';

const { bus } = require('./events');
const domain = require('./domain');

const notifications = [];

function notify(message, level = 'info') {
  const entry = { message, level, at: new Date().toISOString() };
  notifications.unshift(entry);
  if (notifications.length > 50) notifications.pop();
}

// pickupRequested -> assign a collector (this also emits pickupAssigned)
bus.on('pickupRequested', async (payload) => {
  const pickup = payload.pickup;
  if (!pickup) return;
  await domain.assignCollector(pickup);
  notify(`Collector allotted for pickup ${pickup.id}.`, 'success');
});

// pickupAssigned -> acknowledgement for the citizen
bus.on('pickupAssigned', (payload) => {
  notify(
    `${payload.collector} (${payload.vehicle}) allotted for ${payload.pickupId}.`,
    'info'
  );
});

// pickupCompleted -> the green points reward is generated in domain.js
bus.on('pickupCompleted', (payload) => {
  notify(`Pickup ${payload.pickupId} marked Completed.`, 'success');
});

// grievanceSubmitted -> acknowledgement for the complainant
bus.on('grievanceSubmitted', (payload) => {
  notify(
    `Grievance ${payload.grievanceId} registered for ${payload.pickupId || 'no pickup reference'}.`,
    'success'
  );
});

// rewardGenerated -> green points credited
bus.on('rewardGenerated', (payload) => {
  notify(`${payload.points} Green Points credited for ${payload.pickupId}.`, 'success');
});

// certificateGenerated -> certificate issued
bus.on('certificateGenerated', (payload) => {
  notify(`Recycling certificate ${payload.certificateId} issued for ${payload.pickupId}.`, 'success');
});

module.exports = { notifications };