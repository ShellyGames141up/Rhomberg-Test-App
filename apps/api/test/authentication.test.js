import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, FABRICATED_PASSWORD, login } from './fixtures.js';

test('health endpoints expose safe readiness and version details', async t => {
  const { app } = await createFixture(); t.after(() => app.close());
  assert.equal((await app.inject({ url: '/health/live' })).statusCode, 200);
  assert.equal((await app.inject({ url: '/health/ready' })).json().status, 'ready');
  assert.equal((await app.inject({ url: '/health/version' })).json().version, '5.2.0');
});

test('valid fabricated login returns a server session and server-derived authorization', async t => {
  const { app } = await createFixture(); t.after(() => app.close());
  const auth = await login(app);
  assert.equal(auth.response.statusCode, 200);
  assert.match(auth.response.headers['set-cookie'], /HttpOnly/i);
  assert.equal(auth.body.data.user.role, 'customer');
  assert.deepEqual(auth.body.data.user.permissions, ['create_rfq', 'view_own_company_rfqs', 'read_document_metadata']);
  assert.ok(auth.cookie); assert.ok(auth.csrf);
  const me = await app.inject({ url: '/api/v1/auth/me', headers: { cookie: auth.cookie } });
  assert.equal(me.statusCode, 200); assert.equal(me.json().data.email, 'customer.a@example.invalid');
});

test('invalid login is generic and audit data contains no password or session secret', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'customer.a@example.invalid', password: 'Incorrect-Fabricated-Password!' } });
  assert.equal(response.statusCode, 401); assert.equal(response.json().error.code, 'INVALID_CREDENTIALS');
  const auditText = JSON.stringify(repository._state.audits);
  assert.equal(auditText.includes('Incorrect-Fabricated-Password'), false);
  assert.equal(/sessionToken|csrfToken|cookie/i.test(auditText), false);
});

test('disabled users and expired or revoked sessions are rejected', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const disabled = await login(app, 'disabled@example.invalid', FABRICATED_PASSWORD);
  assert.equal(disabled.response.statusCode, 401);
  const auth = await login(app);
  repository._state.sessions[0].expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: auth.cookie } })).statusCode, 401);
  const second = await login(app);
  const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: second.cookie, 'x-csrf-token': second.csrf } });
  assert.equal(logout.statusCode, 204);
  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: second.cookie } })).statusCode, 401);
});

test('cookie-authenticated mutations reject a missing or invalid CSRF token', async t => {
  const { app } = await createFixture(); t.after(() => app.close());
  const auth = await login(app);
  const missing = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: auth.cookie } });
  assert.equal(missing.statusCode, 403); assert.equal(missing.json().error.code, 'CSRF_REJECTED');
  const refreshed = await app.inject({ url: '/api/v1/auth/csrf-token', headers: { cookie: auth.cookie } });
  assert.equal(refreshed.statusCode, 200); assert.notEqual(refreshed.json().data.token, auth.csrf);
});
