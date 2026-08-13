import assert from 'node:assert/strict';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { ADMINISTRATOR_ACCOUNT, STORE_KEYS } from '../src/services/mock/seedData.js';
import { PERMISSIONS, ServiceError, USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const now = () => new Date('2026-08-03T10:00:00.000Z');
const storage = new TestStorage();
const services = createMockServices({ storage, now });
await services.initialize();
await services.auth.signIn({ email: ADMINISTRATOR_ACCOUNT.email, password: ADMINISTRATOR_ACCOUNT.password });

let overview = await services.administration.getOverview();
assert.ok(overview.users.some(user => user.category === 'customer'));
assert.ok(overview.users.some(user => user.category === 'internal'));
assert.ok(overview.users.every(user => !Object.hasOwn(user, 'password')));
assert.ok(overview.catalogue.products.length > 20);
assert.ok(overview.correctionRecords.length > 0);

const capeCompany = overview.companies.find(company => company.id === 'company-demo-cape');
await services.administration.updateCompany(capeCompany.id, {
  values: { name: 'TEST CLIENT - Sales Workflow Test Updated', area: 'Western Cape', industry: 'Process Industry', branchId: 'cape-town' },
  reason: 'Approved customer-company master-data correction.',
});
overview = await services.administration.getOverview();
assert.equal(overview.companies.find(company => company.id === capeCompany.id).name, 'TEST CLIENT - Sales Workflow Test Updated');

const customer = overview.users.find(user => user.companyId === capeCompany.id);
await services.administration.updateAccount(customer.id, {
  values: { contact: 'Lerato Updated', email: 'lerato.updated@client.test', signInName: 'lerato.updated', phone: '+27 21 555 0101', area: 'Western Cape', branchId: 'cape-town', role: USER_ROLES.CUSTOMER },
  reason: 'Customer confirmed updated contact and sign-in details.',
});
await services.administration.assignRepresentative(capeCompany.id, {
  representativeId: 'C-27',
  reason: 'Customer allocation approved by sales management.',
});
await services.administration.updateNotificationPreferences(customer.id, {
  preferences: { channels: { inApp: true, email: false, push: true }, categories: customer.notificationPreferences.categories },
  reason: 'Customer requested email notifications to be disabled.',
});

const product = overview.catalogue.products[0];
await services.administration.saveCatalogueItem('product', product.id, {
  values: { code: product.code, name: `${product.name} Admin Test`, category: product.category, description: product.description, status: 'active' },
  reason: 'Approved catalogue wording update for the demonstration.',
});
assert.match((await services.products.getById(product.id)).name, /Admin Test/);

const internalUser = overview.users.find(user => user.category === 'internal' && user.id !== ADMINISTRATOR_ACCOUNT.id);
await assert.rejects(
  () => services.administration.setAccountPermissions(internalUser.id, { permissions: [PERMISSIONS.ACCESS_INTERNAL_WORKSPACE], reason: 'Approved restricted access test.', verification: 'wrong' }),
  error => error instanceof ServiceError && error.code === 'ADMIN_VERIFICATION_FAILED',
);
await services.administration.setAccountPermissions(internalUser.id, {
  permissions: [PERMISSIONS.ACCESS_INTERNAL_WORKSPACE, PERMISSIONS.READ_CATALOGUE],
  reason: 'Approved least-privilege permission assignment.',
  verification: ADMINISTRATOR_ACCOUNT.password,
});

const correction = overview.correctionRecords.find(record => record.workflowType === 'order');
assert.ok(correction.items?.length, 'authorised administrators must receive immutable configured-unit snapshots through the service layer');
await services.administration.correctRecord(correction.id, {
  values: { contact: 'Approved Contact Correction' },
  expectedVersion: correction.version,
  reason: 'Customer contact was confirmed against the signed PO.',
  verification: ADMINISTRATOR_ACCOUNT.password,
});
await assert.rejects(
  () => services.administration.correctRecord(correction.id, { values: { trackingStatus: 'completed' }, expectedVersion: correction.version + 1, reason: 'Attempt to change protected workflow status.', verification: ADMINISTRATOR_ACCOUNT.password }),
  error => error instanceof ServiceError && error.code === 'IMMUTABLE_FIELD',
);

await assert.rejects(
  () => services.administration.setAccountStatus(customer.id, { status: 'suspended', reason: 'short', verification: ADMINISTRATOR_ACCOUNT.password }),
  error => error instanceof ServiceError && error.code === 'ADMIN_REASON_REQUIRED',
);
await assert.rejects(
  () => services.administration.setAccountStatus(customer.id, { status: 'suspended', reason: 'Approved customer suspension for testing.', verification: 'wrong' }),
  error => error instanceof ServiceError && error.code === 'ADMIN_VERIFICATION_FAILED',
);

const audit = await services.audit.list({});
for (const action of [
  'administration.company_updated', 'administration.account_updated', 'administration.company_representative_assigned',
  'administration.notification_preferences_changed', 'administration.catalogue_product_updated',
  'administration.account_permissions_changed', 'administration.approved_record_corrected',
]) {
  const event = audit.find(item => item.action === action);
  assert.ok(event, `${action} must create audit evidence`);
  assert.ok(event.reason.length >= 8);
  assert.ok(event.previousValue && event.newValue);
  assert.equal(event.immutable, true);
}

const restrictedStorage = new TestStorage();
const restricted = createMockServices({ storage: restrictedStorage, now });
await restricted.initialize();
const rawAccounts = JSON.parse(restrictedStorage.getItem(STORE_KEYS.accounts));
const adminIndex = rawAccounts.findIndex(item => item.id === ADMINISTRATOR_ACCOUNT.id);
rawAccounts[adminIndex].authorisedCompanyIds = ['company-demo-cape'];
rawAccounts[adminIndex].permissions = [
  PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
  PERMISSIONS.ADMINISTER_USERS,
  PERMISSIONS.MANAGE_CUSTOMER_CONTACTS,
  PERMISSIONS.READ_AUDIT_HISTORY,
];
restrictedStorage.setItem(STORE_KEYS.accounts, JSON.stringify(rawAccounts));
await restricted.auth.signIn({ email: ADMINISTRATOR_ACCOUNT.email, password: ADMINISTRATOR_ACCOUNT.password });
const restrictedOverview = await restricted.administration.getOverview();
assert.ok(restrictedOverview.users.filter(user => user.category === 'customer').every(user => user.companyId === 'company-demo-cape'));
await assert.rejects(
  () => restricted.administration.updateCompany('company-demo-cape', { values: { name: 'Denied', area: 'Western Cape', industry: 'Denied', branchId: 'cape-town' }, reason: 'Permission should prevent this company update.' }),
  error => error instanceof ServiceError && error.status === 403,
);
await assert.rejects(
  () => restricted.administration.updateAccount('company-demo-mining', { values: { contact: 'Cross Company', email: 'cross@company.test' }, reason: 'Company isolation must reject this update.' }),
  error => error instanceof ServiceError && error.status === 403,
);

console.log('Administrator permissions, audit evidence, realm separation, company isolation and protected-change tests passed.');
