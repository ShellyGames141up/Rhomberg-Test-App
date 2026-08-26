import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, createRfq, FABRICATED_PASSWORD, ids, login } from './fixtures.js';

const DELETE_REASON = 'Fabricated UAT account is no longer required.';

test('Administrator can soft-delete an account while preserving operational and audit history', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  const customer = await login(app);
  const submitted = await createRfq(app, customer);
  assert.equal(submitted.statusCode, 201, submitted.body);
  const rfqId = submitted.json().data.enquiry.id;

  const administrator = await login(app, 'fabricated-admin', FABRICATED_PASSWORD);
  const deleted = await app.inject({
    method: 'DELETE', url: `/api/v1/admin/users/${ids.customerA}`,
    headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf },
    payload: { reason: DELETE_REASON },
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().data.status, 'deleted');

  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: customer.cookie } })).statusCode, 401);
  assert.equal((await login(app)).response.statusCode, 401);
  assert.equal(repository._state.enquiries.some(item => item.id === rfqId), true, 'historical RFQ must remain');
  assert.equal(repository._state.companies.some(item => item.id === ids.companyA), true, 'company history must remain');
  const audit = repository._state.audits.find(item => item.eventType === 'administrator.user_soft_deleted' && item.entityId === ids.customerA);
  assert.ok(audit);
  assert.equal(audit.companyId, ids.companyA);
  assert.equal(audit.details.hardDeleted, false);
  assert.equal(JSON.stringify(audit).includes(FABRICATED_PASSWORD), false);

  const replay = await app.inject({ method: 'DELETE', url: `/api/v1/admin/users/${ids.customerA}`, headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf }, payload: { reason: DELETE_REASON } });
  assert.equal(replay.statusCode, 404);
});

test('ordinary users cannot delete accounts and Administrators cannot delete themselves', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  const customer = await login(app);
  const denied = await app.inject({ method: 'DELETE', url: `/api/v1/admin/users/${ids.representativeUser}`, headers: { cookie: customer.cookie, 'x-csrf-token': customer.csrf }, payload: { reason: DELETE_REASON } });
  assert.equal(denied.statusCode, 403);

  const administrator = await login(app, 'fabricated-admin', FABRICATED_PASSWORD);
  const selfDelete = await app.inject({ method: 'DELETE', url: `/api/v1/admin/users/${ids.administrator}`, headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf }, payload: { reason: DELETE_REASON } });
  assert.equal(selfDelete.statusCode, 403);
  assert.equal(repository._state.users.find(item => item.id === ids.administrator).status, 'active');
});
