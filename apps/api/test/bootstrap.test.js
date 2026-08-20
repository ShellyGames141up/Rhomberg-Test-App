import assert from 'node:assert/strict';
import test from 'node:test';
import { createBootstrapService, loadBootstrapInput } from '../src/services/bootstrapService.js';
import { hashPassword } from '../src/security/crypto.js';
import { createFixture, login } from './fixtures.js';

const PRIVATE_TEST_SECRET = 'Private-Bootstrap-Test-Only!42';

function bootstrapRepository({ existingAdministrator = false } = {}) {
  const state = { bootstrap: null, administrator: existingAdministrator, commands: [] };
  return {
    state,
    async getBootstrapState() { return state.bootstrap; },
    async hasAdministrator() { return state.administrator; },
    async initialiseAdministrator(command) {
      if (state.bootstrap) return { status: 'already_initialised' };
      if (state.administrator) { const error = new Error('unsafe'); error.code = 'UNSAFE_BOOTSTRAP_REFUSED'; throw error; }
      state.administrator = true;
      state.bootstrap = { completedAt: new Date().toISOString() };
      state.commands.push(command);
      return { status: 'created' };
    },
  };
}

test('bootstrap input is supplied only at runtime and validates a strong secret', () => {
  const input = loadBootstrapInput({ RHOMBERG_API_BOOTSTRAP_USERNAME: 'InitialAdmin', RHOMBERG_API_BOOTSTRAP_PASSWORD: PRIVATE_TEST_SECRET });
  assert.equal(input.username, 'InitialAdmin');
  assert.equal(input.password, PRIVATE_TEST_SECRET);
  assert.throws(() => loadBootstrapInput({ RHOMBERG_API_BOOTSTRAP_USERNAME: 'InitialAdmin', RHOMBERG_API_BOOTSTRAP_PASSWORD: 'weak' }), /16–256/);
});

test('initial Administrator bootstrap is one-time, idempotent and never returns the secret or hash', async () => {
  const repository = bootstrapRepository();
  const service = createBootstrapService({ repository, passwordHasher: async value => `scrypt-test:${value.length}`, idFactory: (() => { let value = 0; return () => `generated-${++value}`; })() });
  const created = await service.initialise({ username: 'InitialAdmin', password: PRIVATE_TEST_SECRET });
  const replay = await service.initialise({ username: 'InitialAdmin', password: PRIVATE_TEST_SECRET });
  assert.deepEqual(created, { status: 'created' });
  assert.deepEqual(replay, { status: 'already_initialised' });
  assert.equal(repository.state.commands.length, 1);
  assert.equal(repository.state.commands[0].username, 'InitialAdmin');
  assert.equal(repository.state.commands[0].password, undefined);
  assert.equal(JSON.stringify([created, replay, repository.state.commands]).includes(PRIVATE_TEST_SECRET), false);
});

test('bootstrap refuses unsafe reinitialisation when an Administrator exists without bootstrap state', async () => {
  const service = createBootstrapService({ repository: bootstrapRepository({ existingAdministrator: true }) });
  await assert.rejects(() => service.initialise({ username: 'InitialAdmin', password: PRIVATE_TEST_SECRET }), error => error.code === 'UNSAFE_BOOTSTRAP_REFUSED');
});

test('there is no unauthenticated browser bootstrap endpoint or local fallback', async t => {
  const { app } = await createFixture();
  t.after(() => app.close());
  for (const url of ['/api/v1/bootstrap', '/api/v1/admin/bootstrap', '/api/v1/auth/bootstrap']) {
    const response = await app.inject({ method: 'POST', url, payload: { username: 'InitialAdmin', password: PRIVATE_TEST_SECRET } });
    assert.equal(response.statusCode, 404);
  }
});

test('the server-authoritative Administrator can create internal users but customers cannot', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  const administratorPassword = 'Administrator-Test-Only!42';
  repository._state.users.push({
    id: '20000000-0000-4000-8000-000000000099', username: 'InitialAdmin', email: null,
    displayName: 'Initial Administrator', passwordHash: await hashPassword(administratorPassword),
    status: 'active', identityProvider: 'local_password', roles: ['administrator'],
    permissions: ['view_all_rfqs', 'read_document_metadata', 'administer_users'], companyIds: [],
  });
  const administrator = await login(app, 'InitialAdmin', administratorPassword);
  assert.equal(administrator.response.statusCode, 200);
  assert.equal(administrator.body.data.user.permissions.includes('administer_users'), true);
  const overview = await app.inject({ method: 'GET', url: '/api/v1/admin/overview', headers: { cookie: administrator.cookie } });
  assert.equal(overview.statusCode, 200);
  assert.equal(overview.json().data.users.some(user => user.username === 'InitialAdmin'), true);
  const payload = { displayName: 'Test Employee', username: 'test.employee', password: 'Employee-Test-Only!42', role: 'sales_representative', reason: 'Approved fabricated test account.' };
  const created = await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf }, payload });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().data.account.username, 'test.employee');
  assert.equal(JSON.stringify(created.json()).includes(payload.password), false);
  const updatedOverview = await app.inject({ method: 'GET', url: '/api/v1/admin/overview', headers: { cookie: administrator.cookie } });
  assert.equal(updatedOverview.json().data.users.some(user => user.username === 'test.employee'), true);
  const customer = await login(app);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers: { cookie: customer.cookie, 'x-csrf-token': customer.csrf }, payload: { ...payload, username: 'denied.employee' } });
  assert.equal(denied.statusCode, 403);
  const deniedOverview = await app.inject({ method: 'GET', url: '/api/v1/admin/overview', headers: { cookie: customer.cookie } });
  assert.equal(deniedOverview.statusCode, 403);
  assert.equal(repository._state.users.some(user => user.username === 'denied.employee'), false);
});
