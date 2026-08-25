import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../src/security/crypto.js';
import { createFixture, login } from './fixtures.js';

const TEMPORARY_PASSWORD = 'Fabricated-Temporary-Password1!';
const REPLACEMENT_PASSWORD = 'Fabricated-Replacement-Password2!';

test('temporary-password accounts are blocked until a server-authoritative password change completes', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  repository._state.users.push({
    id: '20000000-0000-4000-8000-000000000099',
    username: 'fabricated-temporary-user',
    email: 'temporary.user@example.invalid',
    displayName: 'Fabricated Temporary User',
    passwordHash: await hashPassword(TEMPORARY_PASSWORD),
    mustChangePassword: true,
    status: 'active',
    identityProvider: 'local_password',
    roles: ['sales_representative'],
    permissions: ['change_own_password', 'view_assigned_rfqs'],
    companyIds: [],
  });

  const auth = await login(app, 'fabricated-temporary-user', TEMPORARY_PASSWORD);
  assert.equal(auth.response.statusCode, 200);
  assert.equal(auth.body.data.user.forcePasswordChange, true);
  const me = await app.inject({ url: '/api/v1/auth/me', headers: { cookie: auth.cookie } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().data.forcePasswordChange, true);

  const blocked = await app.inject({ url: '/api/v1/orders', headers: { cookie: auth.cookie } });
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.json().error.code, 'PASSWORD_CHANGE_REQUIRED');

  const wrongCurrent = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf }, payload: { currentPassword: 'Incorrect-Current-Password1!', newPassword: REPLACEMENT_PASSWORD } });
  assert.equal(wrongCurrent.statusCode, 401);
  assert.equal(wrongCurrent.json().error.code, 'INVALID_CURRENT_PASSWORD');

  const weak = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf }, payload: { currentPassword: TEMPORARY_PASSWORD, newPassword: 'WeakPasswordOnly1' } });
  assert.equal(weak.statusCode, 422);
  assert.equal(weak.json().error.code, 'PASSWORD_WEAK');

  const changed = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf }, payload: { currentPassword: TEMPORARY_PASSWORD, newPassword: REPLACEMENT_PASSWORD } });
  assert.equal(changed.statusCode, 204);
  assert.match(changed.headers['set-cookie'], /Max-Age=0/i);
  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: auth.cookie } })).statusCode, 401);
  assert.equal((await login(app, 'fabricated-temporary-user', TEMPORARY_PASSWORD)).response.statusCode, 401);

  const replacementLogin = await login(app, 'fabricated-temporary-user', REPLACEMENT_PASSWORD);
  assert.equal(replacementLogin.response.statusCode, 200);
  assert.equal(replacementLogin.body.data.user.forcePasswordChange, false);
  const stored = repository._state.users.find(user => user.username === 'fabricated-temporary-user');
  assert.equal(await verifyPassword(REPLACEMENT_PASSWORD, stored.passwordHash), true);
  assert.equal(stored.mustChangePassword, false);

  const auditText = JSON.stringify(repository._state.audits);
  assert.match(auditText, /authentication\.password_changed/);
  assert.equal(auditText.includes(TEMPORARY_PASSWORD), false);
  assert.equal(auditText.includes(REPLACEMENT_PASSWORD), false);
});

test('password change requires CSRF and cannot be mass-assigned', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  repository._state.users.push({
    id: '20000000-0000-4000-8000-000000000098', username: 'fabricated-csrf-user', email: 'csrf.user@example.invalid',
    displayName: 'Fabricated CSRF User', passwordHash: await hashPassword(TEMPORARY_PASSWORD), mustChangePassword: true,
    status: 'active', identityProvider: 'local_password', roles: ['planning'], permissions: ['change_own_password'], companyIds: [],
  });
  const auth = await login(app, 'fabricated-csrf-user', TEMPORARY_PASSWORD);
  const missingCsrf = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { cookie: auth.cookie }, payload: { currentPassword: TEMPORARY_PASSWORD, newPassword: REPLACEMENT_PASSWORD } });
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(missingCsrf.json().error.code, 'CSRF_REJECTED');
  const injected = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf }, payload: { currentPassword: TEMPORARY_PASSWORD, newPassword: REPLACEMENT_PASSWORD, role: 'administrator' } });
  assert.equal(injected.statusCode, 400);
});
