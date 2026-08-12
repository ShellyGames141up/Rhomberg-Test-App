import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { ADMINISTRATOR_ACCOUNT } from '../src/services/mock/seedData.js';
import { PERMISSIONS, ServiceError, USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new TestStorage();
const services = createMockServices({ storage, now: () => new Date('2026-08-09T10:00:00.000Z') });
await services.initialize();
await services.auth.signIn({ email: ADMINISTRATOR_ACCOUNT.email, password: ADMINISTRATOR_ACCOUNT.password, realm: 'internal' });

const created = await services.administration.createEmployee({
  values: {
    firstName: 'Amina', surname: 'Example', displayName: 'Amina Example', email: '', username: 'lab.amina',
    branchId: 'cape-town', department: 'Pressure Laboratory', primaryRole: USER_ROLES.LABORATORY_TECHNICIAN,
    additionalRoles: [], authenticationType: 'password', activationMethod: 'administrator_temporary_password',
  },
  reason: 'Approved fabricated employee lifecycle test.',
});
assert.equal(created.displayOnce, true);
assert.equal(created.temporaryPassword.length, 18);
assert.equal(created.account.email, '');
assert.equal(created.account.signInName, 'lab.amina');
assert.equal(created.account.status, 'pending_activation');
assert.equal(created.account.forcePasswordChange, true);
assert.ok(!Object.hasOwn(created.account, 'passwordHash'));

await services.administration.assignAccountRoles(created.account.id, {
  roles: [USER_ROLES.LABORATORY_TECHNICIAN, USER_ROLES.LABORATORY_MANAGER_PRESSURE],
  reason: 'Approved fabricated multi-role assignment test.',
  verification: ADMINISTRATOR_ACCOUNT.password,
});
await services.administration.assignAccountBranch(created.account.id, {
  branchId: 'johannesburg', effectiveDate: '2026-08-10', reason: 'Approved fabricated branch transfer test.',
});

const image = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
Object.defineProperty(image, 'name', { value: 'profile.png' });
await services.administration.uploadEmployeeProfileImage(created.account.id, image, { reason: 'Approved fabricated profile picture test.' });

await services.auth.signOut();
const firstLogin = await services.auth.signIn({ email: 'lab.amina', password: created.temporaryPassword, realm: 'internal' });
assert.equal(firstLogin.forcePasswordChange, true);
assert.ok(firstLogin.permissions.includes(PERMISSIONS.ENTER_RAW_CALIBRATION_DATA));
assert.ok(firstLogin.permissions.includes(PERMISSIONS.REVIEW_RAW_LAB_DATA));
const switched = await services.auth.switchWorkspace(USER_ROLES.LABORATORY_MANAGER_PRESSURE);
assert.equal(switched.role, USER_ROLES.LABORATORY_MANAGER_PRESSURE);
await assert.rejects(() => services.auth.switchWorkspace(USER_ROLES.ADMINISTRATOR), error => error instanceof ServiceError && error.status === 403);

const challenge = await services.credentials.requestVerification({ changeType: 'password' });
assert.match(challenge.maskedEmail, /administrator-assisted verification/);
const changed = await services.credentials.confirmChange({ challengeId: challenge.challengeId, code: challenge.demoVerificationCode, newPassword: 'Replacement9!Pass' });
assert.equal(changed.sessionEnded, true);
const active = await services.auth.signIn({ email: 'lab.amina', password: 'Replacement9!Pass', realm: 'internal' });
assert.equal(active.status, 'active');
assert.equal(active.forcePasswordChange, false);

await services.auth.signOut();
await services.auth.signIn({ email: ADMINISTRATOR_ACCOUNT.email, password: ADMINISTRATOR_ACCOUNT.password, realm: 'internal' });
const overview = await services.administration.getOverview();
const directoryUser = overview.users.find(user => user.id === created.account.id);
assert.deepEqual(directoryUser.roles, [USER_ROLES.LABORATORY_TECHNICIAN, USER_ROLES.LABORATORY_MANAGER_PRESSURE]);
assert.equal(directoryUser.branchId, 'johannesburg');
assert.ok(directoryUser.profileImageUrl.startsWith('data:image/png;base64,'));
assert.ok(directoryUser.loginHistoryCount >= 2);
const audit = await services.administration.getUserAudit(created.account.id);
for (const action of ['administration.user_created', 'administration.user_roles_changed', 'administration.user_branch_changed', 'administration.user_profile_image_changed', 'authentication.password_changed', 'authentication.account_activated']) {
  assert.ok(audit.some(event => event.action === action), `${action} must remain in immutable user history; received ${audit.map(event => event.action).join(', ')}`);
}
assert.ok((await services.administration.getUserLoginHistory(created.account.id)).every(event => !Object.hasOwn(event, 'password')));

const reset = await services.administration.resetUserLogin(created.account.id, { reason: 'Approved fabricated login reset test.', verification: ADMINISTRATOR_ACCOUNT.password });
assert.equal(reset.displayOnce, true);
assert.ok(reset.temporaryPassword);
const postResetAudit = await services.administration.getUserAudit(created.account.id);
const auditPayload = JSON.stringify(postResetAudit);
assert.equal(auditPayload.includes(created.temporaryPassword), false, 'initial temporary passwords must never enter audit history');
assert.equal(auditPayload.includes(reset.temporaryPassword), false, 'reset temporary passwords must never enter audit history');
assert.equal(JSON.stringify(await services.administration.getOverview()).includes(reset.temporaryPassword), false, 'temporary passwords must not persist in administrator directory responses');
await services.administration.archiveEmployee(created.account.id, { lastWorkingDate: '2026-08-31', replacementEmployeeId: '', reason: 'Approved fabricated employee offboarding test.', verification: ADMINISTRATOR_ACCOUNT.password });
assert.equal((await services.administration.getOverview()).users.find(user => user.id === created.account.id).status, 'archived');
await assert.rejects(() => services.auth.signIn({ email: 'lab.amina', password: reset.temporaryPassword, realm: 'internal' }), error => error instanceof ServiceError && error.status === 401);

const publicSources = ['src/services/mock/seedData.js', 'src/components/Auth.jsx', 'src/components/AdministratorDashboard.jsx', 'demo/executive-workflow/index.html'].map(path => readFileSync(path, 'utf8')).join('\n');
assert.equal(/@rhom\.co\.za/i.test(publicSources), false, 'real staff email addresses must not enter public demo source or login screens');
const privateValidator = readFileSync('scripts/validate-private-staff.mjs', 'utf8');
assert.ok(privateValidator.includes("path.resolve('private', 'internal-staff.local.json')"));
for (const forbidden of ['passwordHash', 'temporaryPassword', 'secret', 'credential']) assert.ok(privateValidator.includes(forbidden));
const privateContract = readFileSync('docs/PRIVATE_STAFF_IMPORT.md', 'utf8');
for (const requirement of ['ignored local file', 'authenticated backend administration endpoint', 'immutable audit', 'must never contain passwords', 'fabricated']) {
  assert.ok(privateContract.toLowerCase().includes(requirement.toLowerCase()), `private staff import contract must document ${requirement}`);
}

console.log('Reusable employee creation, username login, multi-role workspace, first login, branch, image, audit, reset, archive and public-demo separation tests passed.');
