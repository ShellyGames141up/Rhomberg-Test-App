import assert from 'node:assert/strict';
import {
  applyRetentionState,
  assertDeletionCanProceed,
  DEFAULT_RETENTION_POLICY,
  filterArchiveRecords,
  normaliseRetentionPolicy,
} from '../src/domain/retention.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
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

const now = () => new Date('2026-07-28T15:00:00.000Z');
const completed = {
  id: 'order-retention-domain',
  trackingStatus: 'completed',
  completedAt: '2026-01-01T00:00:00.000Z',
};
const eligible = applyRetentionState(completed, DEFAULT_RETENTION_POLICY, now());
assert.equal(eligible.retentionStatus, 'archive_eligible');
assert.equal(applyRetentionState({ ...completed, completedAt: '2026-07-01T00:00:00.000Z' }, DEFAULT_RETENTION_POLICY, now()).retentionStatus, 'active');
assert.equal(normaliseRetentionPolicy({ archive_completed_orders_after_days: 0 }).archive_completed_orders_after_days, 90);
assert.throws(() => assertDeletionCanProceed({ legalHold: { active: true } }, { ...DEFAULT_RETENTION_POLICY, allow_permanent_deletion: true }, { exportRecord: true, managerApproval: true, administratorApproval: true }), /legal hold/i);
assert.throws(() => assertDeletionCanProceed({}, DEFAULT_RETENTION_POLICY, {}), /disabled/i);

const storage = new TestStorage();
const services = createMockServices({ storage, now });
await services.initialize();
await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });

const activeOrders = await services.orders.list();
assert.equal(activeOrders.some(order => order.reference === 'OR-ARCHIVE-0002'), false, 'archived orders must not remain in active queues');

let archiveRecords = await services.archive.list();
assert.ok(archiveRecords.some(order => order.reference === 'OR-ARCHIVE-0001' && order.retentionStatus === 'archive_eligible'));
assert.ok(archiveRecords.some(order => order.reference === 'OR-ARCHIVE-0002' && order.retentionStatus === 'archived' && order.legalHold.active));
assert.deepEqual(filterArchiveRecords(archiveRecords, { search: 'TEST CLIENT', legalHold: 'held' }).map(order => order.reference), ['OR-ARCHIVE-0002']);

const eligibleOrder = archiveRecords.find(order => order.reference === 'OR-ARCHIVE-0001');
const originalHistoryLength = eligibleOrder.trackingHistory.length;
await services.archive.approveArchival(eligibleOrder.id, { reason: 'Manager approved the annual archival action.' });
await services.archive.archiveOrder(eligibleOrder.id, { reason: 'Annual retention review completed.' });
archiveRecords = await services.archive.list();
const archivedOrder = archiveRecords.find(order => order.id === eligibleOrder.id);
assert.equal(archivedOrder.retentionStatus, 'archived');
assert.equal(archivedOrder.sourceRfqReference, 'RQ-ARCHIVE-0001');
assert.equal(archivedOrder.customerPoNumber, 'PO-ARCHIVE-0001');
assert.equal(archivedOrder.trackingHistory.length, originalHistoryLength, 'archiving must preserve the order timeline');

const exportResult = await services.archive.exportBeforeDeletion(archivedOrder.id);
assert.ok(exportResult.bytesBase64.startsWith('JVBERi0'), 'retention export must be a real internal PDF');
assert.equal(exportResult.classification, 'INTERNAL - RETENTION EXPORT');

await services.archive.setLegalHold(archivedOrder.id, { active: true, reason: 'Quality investigation reference TEST-01.' });
archiveRecords = await services.archive.list({ legalHold: 'held' });
assert.ok(archiveRecords.some(order => order.id === archivedOrder.id));
await services.archive.setLegalHold(archivedOrder.id, { active: false, reason: 'Investigation closed.' });
await services.archive.restoreOrder(archivedOrder.id, { reason: 'Operational review requires restored access.' });
assert.equal((await services.archive.list()).some(order => order.id === archivedOrder.id && order.retentionStatus === 'archived'), false);
assert.ok((await services.orders.list()).some(order => order.id === archivedOrder.id), 'restored order must return to completed history');

await assert.rejects(
  () => services.archive.savePolicy({ ...DEFAULT_RETENTION_POLICY, archive_completed_orders_after_days: 120 }),
  error => error instanceof ServiceError && error.status === 403,
  'manager must not administer the policy',
);
await assert.rejects(
  () => services.archive.requestPermanentDeletion(archivedOrder.id),
  error => error instanceof ServiceError && error.code === 'BACKEND_DELETION_REQUIRED',
  'mock/browser code must never permanently delete an order',
);

const auditEvents = await services.audit.list({ entityId: archivedOrder.id });
for (const action of ['management.archival_approved', 'retention.order_archived', 'retention.export_created', 'retention.legal_hold_applied', 'retention.legal_hold_released', 'retention.order_restored']) {
  assert.ok(auditEvents.some(event => event.action === action), `${action} must create an immutable audit event`);
}

await services.auth.signOut();
await services.auth.signIn({ email: 'administrator.workflow@example.invalid', password: 'Admin123!' });
const savedPolicy = await services.archive.savePolicy({
  ...DEFAULT_RETENTION_POLICY,
  archive_completed_orders_after_days: 120,
  retain_archived_orders_for_days: 3000,
  allow_permanent_deletion: true,
});
assert.equal(savedPolicy.archive_completed_orders_after_days, 120);
assert.equal(savedPolicy.retain_archived_orders_for_days, 3000);
assert.equal(savedPolicy.allow_permanent_deletion, true);
assert.equal(savedPolicy.approvedForProduction, false, 'mock policy changes must never imply production approval');

await services.auth.signOut();
await services.auth.signIn({ email: 'customer.demo@example.invalid', password: 'Demo123!' });
await assert.rejects(
  () => services.archive.list(),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not access the internal archive workspace',
);

console.log('Retention eligibility, archive, restore, legal hold, export, policy and no-browser-deletion tests passed.');
