import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createFixture, createRfq, ids, login } from './fixtures.js';

const reason = 'Fabricated operational record is no longer required.';
const mutate = (app, auth, entityType, recordId) => app.inject({
  method: 'DELETE',
  url: `/api/v1/records/${entityType}/${recordId}`,
  headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf },
  payload: { reason },
});

test('Administrator can soft-delete RFQs and the deleted record leaves active retrieval', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  const customer = await login(app);
  const created = await createRfq(app, customer);
  const rfqId = created.json().data.enquiry.id;
  repository._state.users.find(user => user.id === ids.administrator).permissions.push('delete_operational_records');
  const administrator = await login(app, 'fabricated-admin');

  const deleted = await mutate(app, administrator, 'rfq', rfqId);
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().data.status, 'deleted');
  assert.equal((await app.inject({ url: `/api/v1/enquiries/${rfqId}`, headers: { cookie: administrator.cookie } })).statusCode, 404);
  const audit = repository._state.audits.find(item => item.eventType === 'rfq.soft_deleted' && item.entityId === rfqId);
  assert.ok(audit);
  assert.equal(audit.details.hardDeleted, false);
});

test('Planning can remove only orders still in its own queue', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  const planner = repository._state.users.find(user => user.id === ids.representativeUser);
  planner.roles = ['planning'];
  planner.permissions = ['access_internal_workspace', 'view_planning_queue', 'delete_operational_records'];
  const planningOrderId = randomUUID();
  const expeditingOrderId = randomUUID();
  const rfqId = randomUUID();
  repository._state.orders.push(
    { id: planningOrderId, reference: 'OR-FABRICATED-PLANNING', companyId: ids.companyA, representativeId: ids.representativeA, trackingStatus: 'awaiting_planning', status: 'awaiting_planning', details: {}, createdAt: new Date().toISOString() },
    { id: expeditingOrderId, reference: 'OR-FABRICATED-EXPEDITING', companyId: ids.companyA, representativeId: ids.representativeA, trackingStatus: 'submitted_to_expediting', status: 'submitted_to_expediting', details: {}, createdAt: new Date().toISOString() },
  );
  repository._state.enquiries.push({ id: rfqId, reference: 'RQ-FABRICATED-PLANNING', companyId: ids.companyA, representativeId: ids.representativeA, trackingStatus: 'assigned_to_representative', status: 'assigned_to_representative', details: {}, createdAt: new Date().toISOString() });
  const auth = await login(app, 'representative@example.invalid');

  assert.equal((await mutate(app, auth, 'order', planningOrderId)).statusCode, 200);
  assert.ok(repository._state.orders.find(order => order.id === planningOrderId).deletedAt);
  const denied = await mutate(app, auth, 'order', expeditingOrderId);
  assert.equal(denied.statusCode, 403, denied.body);
  assert.equal(repository._state.orders.find(order => order.id === expeditingOrderId).deletedAt, undefined);
  assert.equal((await mutate(app, auth, 'rfq', rfqId)).statusCode, 403);
});

test('record deletion requires a JSON body with a meaningful reason', async t => {
  const { app, repository } = await createFixture();
  t.after(() => app.close());
  repository._state.users.find(user => user.id === ids.administrator).permissions.push('delete_operational_records');
  const administrator = await login(app, 'fabricated-admin');
  const missing = await app.inject({ method: 'DELETE', url: `/api/v1/records/order/${randomUUID()}`, headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf } });
  assert.equal(missing.statusCode, 400);
  assert.match(missing.body, /body must be object/);
  const tooShort = await app.inject({ method: 'DELETE', url: `/api/v1/records/order/${randomUUID()}`, headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf }, payload: { reason: 'short' } });
  assert.equal(tooShort.statusCode, 400);
});
