import assert from 'node:assert/strict';
import {
  createDefaultNotificationPreferences,
  createNotificationRecord,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENT_CATALOG,
  NOTIFICATION_EVENT_TYPES,
  notificationRequestsForWorkflowAction,
} from '../src/domain/notifications.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { STORE_KEYS } from '../src/services/mock/seedData.js';
import { ServiceError } from '../src/services/contracts.js';

class TestStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const requiredEventTypes = [
  'rfq_submitted',
  'rfq_assigned',
  'rfq_under_review',
  'rfq_quoted',
  'customer_acknowledgement',
  'order_accepted',
  'order_created',
  'order_sent_to_planning',
  'order_sent_to_expediting',
  'customer_progress_update',
  'order_delayed',
  'order_on_hold',
  'order_resumed',
  'order_sent_to_dispatch',
  'ready_for_collection',
  'out_for_delivery',
  'delivery_problem_reported',
  'delivered',
  'collected',
  'completed',
  'order_cancelled',
];

assert.ok(requiredEventTypes.every(type => NOTIFICATION_EVENT_CATALOG[type]), 'the central event catalogue must define every approved workflow notification');
assert.deepEqual(
  new Set(Object.values(NOTIFICATION_DELIVERY_STATUSES)),
  new Set(['in_app', 'email_pending', 'email_sent', 'email_failed', 'push_pending', 'push_sent', 'push_failed']),
  'delivery status values must match the backend contract',
);

const sampleRfq = {
  id: 'rfq-notification-test',
  reference: 'RQ-PREVIEW-NOTIFY',
  workflowType: 'rfq',
  trackingStatus: 'assigned_to_rep',
  companyId: 'company-demo-cape',
  company: 'Fabricated Cape Test Company',
  selectedRep: { id: 'C-27', name: 'Fabricated Representative' },
  trackingHistory: [],
};
const sampleOrder = {
  ...sampleRfq,
  id: 'order-notification-test',
  reference: 'OR-PREVIEW-NOTIFY',
  workflowType: 'order',
  trackingStatus: 'expediting_in_progress',
  trackingHistory: [{
    note: 'Fabricated customer-visible quality review update.',
    customerVisible: true,
    createdAt: '2026-07-27T08:00:00.000Z',
  }],
  expediting: {
    updates: [{
      customerMessage: 'Fabricated customer-visible quality review update.',
      delayReason: 'Fabricated test delay.',
    }],
  },
};
const actor = { id: 'test-actor', role: 'expeditor', displayName: 'Test Actor' };

const sampleNotification = createNotificationRecord({
  id: 'notification-model-test',
  eventType: NOTIFICATION_EVENT_TYPES.CUSTOMER_PROGRESS_UPDATE,
  record: sampleOrder,
  actor,
  occurredAt: '2026-07-27T08:00:00.000Z',
  sourceAction: 'add_expediting_update',
});
assert.equal(sampleNotification.schemaVersion, 2);
assert.equal(sampleNotification.deliveries.length, sampleNotification.recipients.length * 3, 'every recipient must receive in-app, email-simulation and push-simulation delivery entries');
assert.ok(sampleNotification.deliveries.every(delivery => Object.values(NOTIFICATION_DELIVERY_STATUSES).includes(delivery.status)));
assert.ok(sampleNotification.deliveries.every(delivery => delivery.maxAttempts === 3 && 'nextRetryAt' in delivery && 'attemptCount' in delivery), 'delivery entries must remain retry-ready');
assert.equal(sampleNotification.audit.sourceAction, 'add_expediting_update');
assert.equal(sampleNotification.link.entityId, sampleOrder.id);

const acceptanceNotificationRequests = notificationRequestsForWorkflowAction({
  action: 'accept_order',
  record: sampleRfq,
  createdOrder: sampleOrder,
});
assert.deepEqual(
  acceptanceNotificationRequests.map(request => request.eventType),
  ['order_accepted', 'order_created', 'order_sent_to_planning'],
  'acceptance must create distinct acceptance, order-creation and Planning events',
);
assert.ok(
  acceptanceNotificationRequests
    .filter(request => ['order_created', 'order_sent_to_planning'].includes(request.eventType))
    .every(request => request.record.id === sampleOrder.id),
  'order creation and Planning notifications must link to the created order',
);
assert.deepEqual(
  notificationRequestsForWorkflowAction({
    action: 'add_expediting_update',
    record: sampleOrder,
    input: { expeditingUpdate: { delayReason: 'Fabricated test delay.' } },
  }).map(request => request.eventType),
  ['customer_progress_update', 'order_delayed'],
  'a customer-visible delayed progress update must create both progress and delay events',
);

const actionCoverage = [
  ['submit_rfq', sampleRfq],
  ['assign_representative', sampleRfq],
  ['start_rep_review', sampleRfq],
  ['mark_quoted', sampleRfq],
  ['acknowledge_quotation', sampleRfq],
  ['accept_order', sampleRfq, sampleOrder],
  ['submit_to_expediting', sampleOrder],
  ['start_expediting', sampleOrder],
  ['add_expediting_update', sampleOrder],
  ['place_on_hold', sampleOrder],
  ['resume_order', sampleOrder],
  ['complete_expediting', sampleOrder],
  ['mark_ready_for_collection', sampleOrder],
  ['start_delivery', sampleOrder],
  ['report_delivery_problem', sampleOrder],
  ['confirm_delivery', sampleOrder],
  ['confirm_collection', sampleOrder],
  ['complete_delivery', sampleOrder],
  ['complete_collection', sampleOrder],
  ['cancel_order', sampleOrder],
].flatMap(([action, record, createdOrder]) => notificationRequestsForWorkflowAction({ action, record, createdOrder }).map(request => request.eventType));
assert.ok(requiredEventTypes.every(type => actionCoverage.includes(type)), 'every required event must be reachable from a controlled workflow action');

const storage = new TestStorage();
const services = createMockServices({ storage, now: () => new Date('2026-07-27T09:00:00.000Z') });
await services.initialize();

const capeNotification = createNotificationRecord({
  id: 'notification-cape-assignment',
  eventType: NOTIFICATION_EVENT_TYPES.RFQ_ASSIGNED,
  record: sampleRfq,
  actor,
  occurredAt: '2026-07-27T08:10:00.000Z',
  sourceAction: 'assign_representative',
});
const failedEmailIndex = capeNotification.deliveries.findIndex(delivery => delivery.channel === 'email');
capeNotification.deliveries[failedEmailIndex] = {
  ...capeNotification.deliveries[failedEmailIndex],
  status: 'email_failed',
  attemptCount: 1,
  retryable: true,
  lastErrorCode: 'MOCK_DELIVERY_FAILURE',
};
const otherCompanyNotification = createNotificationRecord({
  id: 'notification-other-company',
  eventType: NOTIFICATION_EVENT_TYPES.RFQ_ASSIGNED,
  record: {
    ...sampleRfq,
    id: 'rfq-other-company-notification',
    reference: 'RQ-PREVIEW-OTHER',
    companyId: 'company-demo-mining',
    company: 'Fabricated Mining Test Company',
    selectedRep: { id: 'J-21', name: 'Fabricated Other Representative' },
  },
  actor,
  occurredAt: '2026-07-27T08:20:00.000Z',
  sourceAction: 'assign_representative',
});
storage.setItem(STORE_KEYS.notifications, JSON.stringify([capeNotification, otherCompanyNotification]));

await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
let customerInbox = await services.notifications.list();
assert.deepEqual(customerInbox.map(item => item.id), ['notification-cape-assignment'], 'customers must receive only notifications for their authorised company');
assert.ok(customerInbox[0].deliveries.every(delivery => delivery.recipient === 'customer'), 'customer responses must expose only the customer delivery entries');
assert.equal(customerInbox[0].deliveries.length, 3);
await assert.rejects(
  () => services.notifications.retryDelivery(customerInbox[0].id, customerInbox[0].deliveries.find(delivery => delivery.channel === 'email').id),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not retry delivery infrastructure',
);

const readResult = await services.notifications.markRead(customerInbox[0].id);
assert.equal(readResult.readAt, '2026-07-27T09:00:00.000Z');
assert.equal((await services.notifications.list({ unreadOnly: true })).length, 0);
const markAllResult = await services.notifications.markAllRead();
assert.equal(markAllResult.updatedCount, 0, 'mark-all must preserve independent per-user read state');

const disabledRfqPreferences = {
  ...createDefaultNotificationPreferences(),
  categories: {
    ...createDefaultNotificationPreferences().categories,
    rfqUpdates: false,
  },
};
await services.notifications.savePreferences(disabledRfqPreferences);
assert.equal((await services.notifications.list()).length, 0, 'disabled optional categories must remain stored but be hidden from the current in-app inbox');
await services.notifications.savePreferences({
  ...createDefaultNotificationPreferences(),
  channels: { inApp: true, email: false, push: true },
});
customerInbox = await services.notifications.list();
assert.equal(customerInbox.length, 1);
assert.deepEqual(customerInbox[0].deliveries.map(delivery => delivery.channel), ['in_app', 'push'], 'disabled simulated channels must not appear in the current recipient delivery view');
await services.notifications.savePreferences(createDefaultNotificationPreferences());

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const representativeInbox = await services.notifications.list();
assert.deepEqual(representativeInbox.map(item => item.id), ['notification-cape-assignment'], 'representatives must receive only records assigned to their authoritative representative identity');
assert.ok(representativeInbox[0].deliveries.every(delivery => delivery.recipient === 'assigned_representative'));
assert.equal(representativeInbox[0].readAt, '', 'one customer reading a notification must not mark it read for the representative');

await services.auth.signOut();
await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
const managementInbox = await services.notifications.list();
assert.equal(managementInbox.length, 2, 'authorised management scope may view notifications across operational records');
const failedDelivery = managementInbox
  .find(notification => notification.id === capeNotification.id)
  .deliveries.find(delivery => delivery.id === capeNotification.deliveries[failedEmailIndex].id);
const retryResult = await services.notifications.retryDelivery(capeNotification.id, failedDelivery.id);
assert.equal(retryResult.attemptCount, 2);
assert.equal(retryResult.status, 'email_sent');
assert.equal(retryResult.retryable, false);

const audit = await services.audit.list();
assert.ok(audit.some(event => event.action === 'notification.read'));
assert.ok(audit.some(event => event.action === 'notification.read_all'));
assert.ok(audit.some(event => event.action === 'notification.preferences_updated'));
assert.ok(audit.some(event => event.action === 'notification.delivery_retry_requested'));

console.log('Central notification model, isolation, preferences, read state and simulated delivery tests passed.');
