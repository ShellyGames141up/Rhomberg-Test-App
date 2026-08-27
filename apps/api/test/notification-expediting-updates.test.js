import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, login, ids } from './fixtures.js';
import { EXPEDITOR_PROGRESS_STEPS, expeditorUpdateSteps } from '../../../src/domain/expediting.js';
import { validateExpeditingAction } from '../../../src/services/validation.js';
import { createPhase1WorkspaceService } from '../src/services/phase1WorkspaceService.js';

test('Expediting options retain selectable flags, required steps and document objects', () => {
  const options = createPhase1WorkspaceService({ repository: {} }).getExpeditingOptions();
  assert.deepEqual(options.progressSteps, EXPEDITOR_PROGRESS_STEPS);
  assert.ok(expeditorUpdateSteps(options.progressSteps).length > 5);
  for (const step of expeditorUpdateSteps(options.progressSteps)) {
    assert.doesNotThrow(() => validateExpeditingAction('add_expediting_update', { expeditingProgressStep: step.id, expeditingCustomerMessage: 'Fabricated progress update.' }, options));
  }
  assert.throws(() => validateExpeditingAction('add_expediting_update', { expeditingProgressStep: 'on_hold', expeditingCustomerMessage: 'Must use hold workflow.' }, options));
  assert.ok(options.documentTypes.every(item => item.id && item.label));
});

test('notification reads are recipient-only, idempotent, CSRF-protected and audited', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const customer = await login(app);
  const id = randomUUID(), other = randomUUID();
  repository._state.notifications.push({ id, recipientUserId: ids.customerA, title: 'Fabricated update' }, { id: other, recipientUserId: ids.customerB, title: 'Other company update' });
  const headers = { cookie: customer.cookie, 'x-csrf-token': customer.csrf };
  const first = await app.inject({ method: 'POST', url: '/api/v1/notifications/' + id + '/read', headers });
  assert.equal(first.statusCode, 200, first.body);
  const repeat = await app.inject({ method: 'POST', url: '/api/v1/notifications/' + id + '/read', headers });
  assert.equal(repeat.json().data.readAt, first.json().data.readAt);
  assert.equal(repository._state.audits.filter(item => item.eventType === 'notification.read').length, 1);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/notifications/' + other + '/read', headers })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/notifications/' + id + '/read', headers: { cookie: customer.cookie } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/notifications/not-a-uuid/read', headers })).statusCode, 422);
  const batch = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all', headers });
  assert.equal(batch.statusCode, 200);
  assert.equal(typeof batch.json().data.updatedCount, 'number');
  assert.equal(repository._state.notifications.find(item => item.id === other).readAt, undefined);
  assert.equal((await app.inject({ url: '/api/v1/workspace/updates' })).statusCode, 401);
  const revision = await app.inject({ url: '/api/v1/workspace/updates', headers });
  assert.equal(revision.statusCode, 200, revision.body);
  assert.match(revision.json().data.revision, /^[0-9a-f]{64}$/);
  assert.equal(revision.headers['cache-control'], 'no-store');
});
