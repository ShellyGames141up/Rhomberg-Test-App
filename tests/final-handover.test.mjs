import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import {
  ADMINISTRATOR_ACCOUNT,
  DEMO_ACCOUNT,
  LAB_ACCOUNT,
  STORE_KEYS,
} from '../src/services/mock/seedData.js';
import {
  EXECUTIVE_DEMO_ROLES,
  EXECUTIVE_DEMO_SCENARIOS,
  executiveDemoProgress,
} from '../src/domain/executiveDemo.js';
import { defaultViewForRole, normaliseViewForRole } from '../src/domain/accessControl.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new TestStorage();
const services = createMockServices({ storage, now: () => new Date('2026-07-29T09:00:00.000Z') });
await services.initialize();

assert.equal(EXECUTIVE_DEMO_SCENARIOS.length, 11);
assert.ok(EXECUTIVE_DEMO_SCENARIOS.some(item => item.id === 'sales-representative-client-visit'));
assert.ok(EXECUTIVE_DEMO_SCENARIOS.some(item => item.id === 'missed-client-visit'));
for (const role of [
  USER_ROLES.CUSTOMER,
  USER_ROLES.SALES_REPRESENTATIVE,
  USER_ROLES.SALES_MANAGER,
  USER_ROLES.TECHNICAL_SUPPORT,
  USER_ROLES.TECHNICAL_DIRECTOR,
  USER_ROLES.COMPANY_OWNER,
  USER_ROLES.PLANNING,
  USER_ROLES.LABORATORY_USER,
  USER_ROLES.LABORATORY_TECHNICIAN,
  USER_ROLES.LABORATORY_MANAGER,
  USER_ROLES.TECHNICAL_SIGNATORY,
  USER_ROLES.LABORATORY_ADMINISTRATOR,
  USER_ROLES.EXPEDITOR,
  USER_ROLES.QUALITY_ASSURANCE,
  USER_ROLES.DISPATCH,
  USER_ROLES.ADMINISTRATOR,
]) assert.ok(EXECUTIVE_DEMO_ROLES.some(item => item.role === role), `${role} must be available in the Executive Demo`);

const selectedScenario = await services.executiveDemo.selectScenario('sanas-calibration');
assert.equal(selectedScenario.scenarioId, 'sanas-calibration');
assert.equal((await services.executiveDemo.setStep(3)).stepIndex, 3);
assert.equal((await services.executiveDemo.setLayoutMode('device')).layoutMode, 'device');
assert.equal((await services.executiveDemo.setDevicePreview('tablet')).devicePreview, 'tablet');
assert.equal(executiveDemoProgress(await services.executiveDemo.getState()).currentStep, EXECUTIVE_DEMO_SCENARIOS[1].steps[3]);

const reopened = createMockServices({ storage, now: () => new Date('2026-07-29T09:05:00.000Z') });
await reopened.initialize();
assert.equal((await reopened.executiveDemo.getState()).stepIndex, 3, 'presenter progress must survive refresh/reinitialisation');
assert.equal((await reopened.executiveDemo.getState()).layoutMode, 'device', 'presenter layout must survive refresh/reinitialisation');
assert.equal((await reopened.executiveDemo.getState()).devicePreview, 'tablet', 'presenter device frame must survive refresh/reinitialisation');

const switchedCustomer = await reopened.executiveDemo.switchRole(USER_ROLES.CUSTOMER);
assert.equal(switchedCustomer.id, DEMO_ACCOUNT.id);
assert.equal(defaultViewForRole(switchedCustomer.role), 'home');
const switchedLab = await reopened.executiveDemo.switchRole(USER_ROLES.LABORATORY_USER);
assert.equal(switchedLab.id, LAB_ACCOUNT.id);
assert.equal(defaultViewForRole(switchedLab.role), 'expeditor');
const switchedAdmin = await reopened.executiveDemo.switchRole(USER_ROLES.ADMINISTRATOR);
assert.equal(switchedAdmin.id, ADMINISTRATOR_ACCOUNT.id);
assert.equal(defaultViewForRole(switchedAdmin.role), 'administration');
assert.equal(normaliseViewForRole(USER_ROLES.CUSTOMER, 'administration'), 'home');
assert.equal(normaliseViewForRole(USER_ROLES.LABORATORY_USER, 'administration'), 'expeditor');

const overview = await reopened.administration.getOverview();
assert.ok(overview.summary.users >= EXECUTIVE_DEMO_ROLES.length);
assert.ok(overview.users.every(user => !Object.hasOwn(user, 'password')));
assert.ok(overview.roles.some(role => role.id === USER_ROLES.ADMINISTRATOR));
assert.ok(overview.configurations.laboratory.certificationTypes.includes('sanas'));
assert.ok(overview.integrationPlaceholders.length >= 5);

await reopened.auth.signOut();
await reopened.auth.signIn({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
await assert.rejects(
  () => reopened.administration.getOverview(),
  error => error instanceof ServiceError && error.status === 403,
  'customer accounts must not access Administration by changing a view or calling the service',
);

await reopened.auth.signOut();
await reopened.auth.signIn({ email: ADMINISTRATOR_ACCOUNT.email, password: ADMINISTRATOR_ACCOUNT.password });
const target = overview.users.find(user => user.role === USER_ROLES.LABORATORY_USER);
await reopened.administration.setAccountStatus(target.id, { status: 'suspended', reason: 'Approved fabricated suspension test.', verification: ADMINISTRATOR_ACCOUNT.password });
await reopened.auth.signOut();
await assert.rejects(
  () => reopened.auth.signIn({ email: LAB_ACCOUNT.email, password: LAB_ACCOUNT.password }),
  error => error instanceof ServiceError && error.status === 401,
  'a suspended fabricated account must not sign in',
);
await reopened.executiveDemo.switchRole(USER_ROLES.ADMINISTRATOR);
await reopened.administration.setAccountStatus(target.id, { status: 'active', reason: 'Restore the fabricated account after the test.' });
await reopened.administration.resetDemoData();
const resetAudit = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(resetAudit.some(event => event.action === 'administration.demo_data_reset'));

const productionBuild = readFileSync('scripts/build-production.mjs', 'utf8');
for (const marker of [
  'ProductionExecutiveWorkflowDemo.jsx',
  'Executive Demo Mode',
  'sanas-calibration',
  'department-tour',
]) assert.ok(productionBuild.includes(marker), `production exclusion must cover ${marker}`);

for (const document of [
  'README.md',
  'docs/DEPLOYMENT_HANDOVER.md',
  'docs/EXECUTIVE_DEMO_GUIDE.md',
  'docs/PDF_AND_EMAIL_EXPORT.md',
  'docs/RETENTION_AND_ARCHIVING.md',
  'docs/TESTING.md',
  '.env.example',
]) assert.ok(readFileSync(document, 'utf8').length > 100, `${document} must be present and substantive`);

console.log('Administrator permissions, Executive Demo persistence/role switching, documentation and production exclusions passed.');
