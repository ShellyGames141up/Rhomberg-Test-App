import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { createFixture, createRfq, FABRICATED_PASSWORD, login } from './fixtures.js';

const WINDOWS_ORIGIN = 'https://connect.rhom.co.za:8443';
const ANDROID_ORIGIN = 'https://connect.rhom.co.za';
const ATTACKER_ORIGIN = 'https://attacker.example.invalid';

const stagingEnvironment = overrides => ({
  RHOMBERG_API_ENV: 'staging',
  RHOMBERG_API_SESSION_PEPPER: 'fabricated-staging-session-pepper-at-least-32-characters',
  RHOMBERG_API_DATABASE_URL: 'postgresql://fabricated.invalid/database',
  RHOMBERG_API_COOKIE_SECURE: 'true',
  RHOMBERG_API_ALLOWED_ORIGINS: `${WINDOWS_ORIGIN},${ANDROID_ORIGIN}`,
  ...overrides,
});

const stagingFixture = options => createFixture({
  ...options,
  configOverrides: {
    environment: 'staging',
    cookieSecure: true,
    allowedOrigins: [WINDOWS_ORIGIN, ANDROID_ORIGIN],
    logLevel: options?.logger ? 'info' : 'silent',
  },
});

const originHeaders = (origin, headers = {}) => ({ origin, ...headers });

test('staging configuration accepts only reviewed exact HTTPS origins', () => {
  const config = loadConfig(stagingEnvironment());
  assert.deepEqual(config.allowedOrigins, [WINDOWS_ORIGIN, ANDROID_ORIGIN]);
  assert.deepEqual(loadConfig(stagingEnvironment({ RHOMBERG_API_ALLOWED_ORIGINS: 'https://connect.rhom.co.za:443' })).allowedOrigins, [ANDROID_ORIGIN]);
  for (const value of [
    'http://connect.rhom.co.za',
    'https://connect.rhom.co.za:9443',
    'https://connect.rhomberg.co.za',
    'https://app.connect.rhomberg.co.za',
    'https://app.connect.rhomberg.co.za:8443',
    'https://evil.example',
    'https://user:secret@connect.rhom.co.za',
    'https://connect.rhom.co.za/path',
    '*',
  ]) assert.throws(() => loadConfig(stagingEnvironment({ RHOMBERG_API_ALLOWED_ORIGINS: value })), /origin/i);
  assert.throws(() => loadConfig(stagingEnvironment({ RHOMBERG_API_ALLOWED_ORIGIN: WINDOWS_ORIGIN })), /both origin variables/i);
});

test('approved Android preflight receives strict credentialed CORS headers', async t => {
  const { app } = await stagingFixture(); t.after(() => app.close());
  const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/auth/login', headers: originHeaders(ANDROID_ORIGIN, {
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type, x-request-id, x-csrf-token, idempotency-key',
  }) });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], ANDROID_ORIGIN);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
  assert.match(response.headers.vary, /Origin/);
  assert.equal(response.headers['access-control-allow-methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  assert.doesNotMatch(response.headers['access-control-allow-origin'], /\*/);
});

test('invalid origin, method and headers are rejected before authentication', async t => {
  const { app } = await stagingFixture(); t.after(() => app.close());
  const preflight = headers => app.inject({ method: 'OPTIONS', url: '/api/v1/auth/login', headers });
  assert.equal((await preflight(originHeaders(ATTACKER_ORIGIN, { 'access-control-request-method': 'POST' }))).statusCode, 403);
  assert.equal((await preflight(originHeaders(ANDROID_ORIGIN, { 'access-control-request-method': 'TRACE' }))).statusCode, 403);
  assert.equal((await preflight(originHeaders(ANDROID_ORIGIN, { 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' }))).statusCode, 403);
});

test('approved single-domain Android origin completes login, persistent session, CSRF mutation and logout', async t => {
  const { app } = await stagingFixture(); t.after(() => app.close());
  const authenticated = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: originHeaders(ANDROID_ORIGIN), payload: { email: 'customer.a@example.invalid', password: FABRICATED_PASSWORD } });
  assert.equal(authenticated.statusCode, 200);
  assert.equal(authenticated.headers['access-control-allow-origin'], ANDROID_ORIGIN);
  assert.equal(authenticated.headers['access-control-allow-credentials'], 'true');
  assert.match(authenticated.headers['set-cookie'], /HttpOnly/i);
  assert.match(authenticated.headers['set-cookie'], /Secure/i);
  assert.match(authenticated.headers['set-cookie'], /SameSite=Lax/i);
  assert.doesNotMatch(authenticated.headers['set-cookie'], /SameSite=None/i);
  const body = authenticated.json();
  const auth = { cookie: authenticated.headers['set-cookie'].split(';')[0], csrf: body.data.csrfToken };

  const me = await app.inject({ url: '/api/v1/auth/me', headers: originHeaders(ANDROID_ORIGIN, { cookie: auth.cookie }) });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().data.email, 'customer.a@example.invalid');

  const created = await createRfq(app, auth, undefined, 'android-auth-flow-key', ANDROID_ORIGIN);
  assert.equal(created.statusCode, 201);
  const resumed = await app.inject({ url: '/api/v1/auth/me', headers: originHeaders(ANDROID_ORIGIN, { cookie: auth.cookie }) });
  assert.equal(resumed.statusCode, 200);
  assert.equal(resumed.json().data.email, 'customer.a@example.invalid');
  const missingCsrf = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: originHeaders(ANDROID_ORIGIN, { cookie: auth.cookie }) });
  assert.equal(missingCsrf.statusCode, 403);
  const attacker = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: originHeaders(ATTACKER_ORIGIN, { cookie: auth.cookie, 'x-csrf-token': auth.csrf }) });
  assert.equal(attacker.statusCode, 403);

  const logout = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: originHeaders(ANDROID_ORIGIN, { cookie: auth.cookie, 'x-csrf-token': auth.csrf }) });
  assert.equal(logout.statusCode, 204);
  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: originHeaders(ANDROID_ORIGIN, { cookie: auth.cookie }) })).statusCode, 401);
});

test('Windows PWA origin retains the same cookie-authentication flow', async t => {
  const { app } = await stagingFixture(); t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: originHeaders(WINDOWS_ORIGIN), payload: { email: 'customer.a@example.invalid', password: FABRICATED_PASSWORD } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['access-control-allow-origin'], WINDOWS_ORIGIN);
  const cookie = response.headers['set-cookie'].split(';')[0];
  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: originHeaders(WINDOWS_ORIGIN, { cookie }) })).statusCode, 200);
});

test('session and CSRF secrets are redacted from structured logs', async t => {
  let logs = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { logs += chunk.toString(); callback(); } });
  const { app } = await stagingFixture({ logger: true, logStream: stream }); t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: originHeaders(ANDROID_ORIGIN), payload: { email: 'customer.a@example.invalid', password: FABRICATED_PASSWORD } });
  const sessionToken = response.headers['set-cookie'].split(';')[0].split('=')[1];
  const csrfToken = response.json().data.csrfToken;
  assert.equal(logs.includes(FABRICATED_PASSWORD), false);
  assert.equal(logs.includes(sessionToken), false);
  assert.equal(logs.includes(csrfToken), false);
});
