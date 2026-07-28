import assert from 'node:assert/strict';
import {
  buildManagementDashboard,
  createOperationalReportCsv,
  sanitiseManagementRecord,
} from '../src/domain/management.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { PERMISSIONS, ServiceError } from '../src/services/contracts.js';
import { STORE_KEYS } from '../src/services/mock/seedData.js';

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
const sourceRecord = {
  id: 'order-management-domain',
  workflowType: 'order',
  trackingStatus: 'expediting_in_progress',
  reference: 'OR-MANAGEMENT-001',
  companyId: 'company-a',
  company: 'Authorised Company',
  contact: 'Authorised Contact',
  selectedRep: { id: 'C-27', name: 'Ericu Vercuiel', branchId: 'cape-town', branchName: 'Cape Town' },
  price: 1234,
  pricing: { margin: 20 },
  items: [{ code: 'PBG', unitPrice: 12, configuration: { range: '0 to 10 bar' } }],
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-21T08:00:00.000Z',
  trackingHistory: [
    { id: 'a', createdAt: '2026-07-20T08:00:00.000Z' },
    { id: 'b', createdAt: '2026-07-20T20:00:00.000Z' },
  ],
};
const safeRecord = sanitiseManagementRecord(sourceRecord);
assert.equal('price' in safeRecord, false);
assert.equal('pricing' in safeRecord, false);
assert.equal('unitPrice' in safeRecord.items[0], false);

const domainDashboard = buildManagementDashboard({ records: [sourceRecord], now: now() });
assert.equal(domainDashboard.metrics.inExpediting, 1);
assert.equal(domainDashboard.metrics.averageStageHours, 12);
assert.equal(domainDashboard.ageing[0].ageDays, 7);
assert.match(createOperationalReportCsv(domainDashboard), /OR-MANAGEMENT-001/);
assert.doesNotMatch(createOperationalReportCsv(domainDashboard), /1234/);

const storage = new TestStorage();
const services = createMockServices({ storage, now });
await services.initialize();
const manager = await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
for (const permission of [
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.REASSIGN_REPRESENTATIVE,
  PERMISSIONS.APPROVE_WORKFLOW_OVERRIDE,
  PERMISSIONS.APPROVE_ARCHIVAL,
  PERMISSIONS.EXPORT_OPERATIONAL_REPORTS,
]) assert.ok(manager.permissions.includes(permission), `manager must receive ${permission}`);

let dashboard = await services.management.getDashboard();
for (const metric of [
  'openRfqs',
  'awaitingRepresentativeAction',
  'quotedRfqs',
  'awaitingPlanning',
  'inExpediting',
  'onHold',
  'delayed',
  'inDispatch',
  'completed',
  'archived',
  'emergency',
  'averageStageHours',
]) assert.ok(metric in dashboard.metrics, `dashboard must expose ${metric}`);
assert.ok(dashboard.records.length > 0);

const target = dashboard.records.find(record => record.reference === 'RQ-TEST-0005');
assert.ok(target, 'fabricated representative-action RFQ must be available to management');
const reassigned = await services.management.reassignRepresentative(target.id, {
  representativeId: 'C-11',
  reason: 'Balancing the authorised Cape Town RFQ workload.',
  expectedVersion: target.version,
});
assert.equal(reassigned.selectedRep.id, 'C-11');
const overridden = await services.management.approveWorkflowOverride(target.id, {
  targetStatus: 'under_rep_review',
  reason: 'Approved correction after the representative handover was independently checked.',
  entityType: 'rfq',
  expectedVersion: reassigned.version,
});
assert.equal(overridden.trackingStatus, 'under_rep_review');

const report = await services.management.exportOperationalReport({ search: 'Cape Process' });
assert.equal(report.mimeType, 'text/csv;charset=utf-8');
assert.ok(report.rowCount > 0);
assert.doesNotMatch(report.csv, /unitPrice|priceEngine|pricingResult/i);

const managementAudit = await services.audit.list({ entityId: target.id });
assert.ok(managementAudit.some(event => event.action === 'management.representative_reassigned'));
assert.ok(managementAudit.some(event => event.action === 'management.workflow_override_approved'));

await services.auth.signOut();
await services.auth.signIn({ email: 'customer.demo@example.invalid', password: 'Demo123!' });
await assert.rejects(
  () => services.management.getDashboard(),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not access management oversight',
);

const restrictedStorage = new TestStorage();
const restrictedServices = createMockServices({ storage: restrictedStorage, now });
await restrictedServices.initialize();
const accounts = JSON.parse(restrictedStorage.getItem(STORE_KEYS.accounts));
const managerIndex = accounts.findIndex(account => account.email === 'manager.workflow@example.invalid');
accounts[managerIndex].authorisedCompanyIds = ['company-demo-cape'];
restrictedStorage.setItem(STORE_KEYS.accounts, JSON.stringify(accounts));
await restrictedServices.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
dashboard = await restrictedServices.management.getDashboard();
assert.ok(dashboard.records.length > 0);
assert.ok(dashboard.records.every(record => record.companyId === 'company-demo-cape'), 'restricted management scope must never cross authorised companies');

console.log('Management metrics, protected-pricing exclusion, actions, reports and company isolation tests passed.');
