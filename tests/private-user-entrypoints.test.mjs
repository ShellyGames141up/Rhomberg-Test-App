import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { APPLICATION_ACCESS_MATRIX, APPLICATION_SURFACES, applicationSurfaceAllowsRole } from '../src/shared/platform/applicationAccess.js';
import { previewAllowsRole, previewContextForPath, PREVIEW_IDS } from '../src/shared/platform/previewConfig.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { FABRICATED_REP_CLIENTS } from '../src/domain/clientVisits.js';
import { FABRICATED_REP_TEST_CLIENT_ASSIGNMENTS, SALES_ACCOUNT } from '../src/services/mock/seedData.js';
import { USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const privateTemplate = JSON.parse(readFileSync('private-config/internal-staff.example.json', 'utf8'));
assert.match(privateTemplate.notice, /PRIVATE CONFIGURATION PLACEHOLDERS ONLY/);
assert.ok(privateTemplate.staff.length >= 14);
for (const account of privateTemplate.staff) {
  assert.match(account.displayName, /OWNER TO SUPPLY/);
  assert.ok(account.username.startsWith('OWNER_TO_SUPPLY_'));
  for (const forbidden of ['password', 'passwordHash', 'temporaryPassword', 'secret']) assert.equal(forbidden in account, false);
}

const requiredRoles = [
  USER_ROLES.ADMINISTRATOR, USER_ROLES.COMPANY_OWNER, USER_ROLES.MANAGER, USER_ROLES.SALES_MANAGER,
  USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.EXPEDITOR, USER_ROLES.PLANNING, USER_ROLES.DISPATCH,
  USER_ROLES.LABORATORY_MANAGER, USER_ROLES.QUALITY_ASSURANCE,
  USER_ROLES.QUALITY_MANAGER, USER_ROLES.TECHNICAL_SUPPORT, USER_ROLES.TECHNICAL_DIRECTOR,
];
for (const role of requiredRoles) assert.ok(privateTemplate.staff.some(account => account.roles.includes(role)), `${role} requires an owner-supplied private account placeholder`);
assert.equal(APPLICATION_ACCESS_MATRIX[USER_ROLES.BUYER].status, 'prepared_inactive');

for (const role of [USER_ROLES.CUSTOMER, USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.EXPEDITOR, USER_ROLES.MANAGER]) {
  assert.equal(applicationSurfaceAllowsRole(APPLICATION_SURFACES.DESKTOP, role), true);
  assert.equal(applicationSurfaceAllowsRole(APPLICATION_SURFACES.MOBILE, role), true);
}
for (const role of [USER_ROLES.PLANNING, USER_ROLES.DISPATCH, USER_ROLES.LABORATORY_MANAGER, USER_ROLES.QUALITY_ASSURANCE, USER_ROLES.QUALITY_MANAGER, USER_ROLES.TECHNICAL_SUPPORT, USER_ROLES.TECHNICAL_DIRECTOR, USER_ROLES.SALES_MANAGER, USER_ROLES.COMPANY_OWNER, USER_ROLES.ADMINISTRATOR]) {
  assert.equal(applicationSurfaceAllowsRole(APPLICATION_SURFACES.DESKTOP, role), true);
  assert.equal(applicationSurfaceAllowsRole(APPLICATION_SURFACES.MOBILE, role), false);
}
assert.equal(applicationSurfaceAllowsRole(APPLICATION_SURFACES.DESKTOP, USER_ROLES.LABORATORY_USER), false, 'inactive technicians cannot unlock the launch workspace by URL');

const desktop = previewContextForPath('/Rhomberg-Test-App/desktop/');
const mobile = previewContextForPath('/Rhomberg-Test-App/mobile/');
assert.equal(desktop.id, PREVIEW_IDS.APPLICATION_DESKTOP);
assert.equal(mobile.id, PREVIEW_IDS.APPLICATION_MOBILE);
assert.equal(previewAllowsRole(mobile, USER_ROLES.ADMINISTRATOR), false, 'changing the URL must not unlock a desktop-only role');
assert.equal(previewAllowsRole(desktop, USER_ROLES.ADMINISTRATOR), true);

for (const route of ['desktop', 'mobile']) {
  const html = readFileSync(`${route}/index.html`, 'utf8');
  assert.ok(html.includes(`content="application-${route}"`));
  assert.ok(html.includes('app.js?v=44'));
  assert.doesNotMatch(html, /Preview Centre|preview\//i);
}
const appSource = readFileSync('src/App.jsx', 'utf8');
assert.ok(appSource.includes('normalPublicRouteRejectsDemoIdentity'));
assert.ok(appSource.includes("useState('light')"));
assert.ok(appSource.indexOf('return <Intro onComplete') < appSource.indexOf('if (!account) return <Auth'), 'splash must precede sign in');

assert.equal(FABRICATED_REP_TEST_CLIENT_ASSIGNMENTS.length, 1);
const assignment = FABRICATED_REP_TEST_CLIENT_ASSIGNMENTS[0];
assert.equal(assignment.representativeAccountId, SALES_ACCOUNT.id);
assert.deepEqual(assignment.supportedSurfaces, ['desktop', 'mobile']);
assert.match(assignment.testCompanyName, /^TEST CLIENT - /);
assert.match(assignment.customerLogin, /\.(?:invalid|test)$/);

const storage = new TestStorage();
const services = createMockServices({ storage, now: () => new Date('2026-08-13T08:00:00.000Z') });
await services.initialize();
await services.auth.signIn({ email: SALES_ACCOUNT.email, password: SALES_ACCOUNT.password });
const visibleClients = await services.clientVisits.listClients();
assert.ok(visibleClients.length > 0);
assert.ok(visibleClients.every(client => client.representativeId === SALES_ACCOUNT.representativeId), 'Rep A must only receive Rep A clients');
assert.ok(FABRICATED_REP_CLIENTS.some(client => client.representativeId !== SALES_ACCOUNT.representativeId), 'the fixture must contain a Rep B client to prove isolation');
assert.equal(visibleClients.some(client => client.representativeId !== SALES_ACCOUNT.representativeId), false);

const generator = readFileSync('scripts/generate-private-credentials.py', 'utf8');
for (const marker of ['secrets.choice', 'SystemRandom().shuffle', 'length: int = 20', 'AES-256-R5', 'RHOMBERG_CREDENTIAL_PDF_PASSWORD', 'os.environ.get', 'temp_path.unlink']) assert.ok(generator.includes(marker));
assert.equal(/DOCUMENT_PASSWORD\s*=\s*["']/.test(generator), false, 'the private document password must never be hard-coded');
const gitignore = readFileSync('.gitignore', 'utf8');
assert.ok(gitignore.includes('private/'));
assert.ok(gitignore.includes('*RHOMBERG_CONNECT_INITIAL_USER_CREDENTIALS*.pdf'));
assert.equal(existsSync('private/internal-staff.local.json'), false, 'no private staff roster may be committed in this public workspace');

console.log('Private user placeholders, entry routes, access matrix, demo separation and representative client isolation passed.');
