import assert from 'node:assert/strict';
import { HttpClient } from '../src/services/api/HttpClient.js';
import { friendlyServiceError, ServiceError } from '../src/services/contracts.js';
import {
  validateExpeditingAction,
  validatePlanningSubmission,
} from '../src/services/validation.js';

assert.throws(
  () => validatePlanningSubmission({
    planningInternalJobNumber: 'JOB-TEST-PAST',
    planningSalesOrderNumber: 'SO-TEST-PAST',
    planningCustomerPoNumber: 'PO-TEST-PAST',
    planningStartDate: '2026-07-20',
    planningEstimatedCompletionDate: '2026-07-27',
    planningAssignedUserId: 'planning-test',
    planningPriority: 'standard',
    planningSubmissionDate: '2026-07-28',
  }, { today: '2026-07-28' }),
  error => error instanceof ServiceError
    && error.code === 'VALIDATION_ERROR'
    && /past/i.test(error.fieldErrors.planningEstimatedCompletionDate),
);

assert.throws(
  () => validateExpeditingAction('add_expediting_update', {
    expeditingProgressStep: 'assembly_in_progress',
    expeditingCustomerMessage: 'Assembly is progressing in the fabricated test.',
    expeditingEstimatedCompletionDate: '2026-07-27',
  }, { today: '2026-07-28' }),
  error => error instanceof ServiceError
    && error.code === 'VALIDATION_ERROR'
    && /past/i.test(error.fieldErrors.expeditingEstimatedCompletionDate),
);

assert.equal(
  friendlyServiceError(new Error('SQL connection string and stack trace'), 'The request could not be completed.'),
  'The request could not be completed.',
  'unexpected internal errors must not expose stack traces or infrastructure details',
);
assert.equal(
  friendlyServiceError(new ServiceError('Your session has ended. Please sign in again.', { code: 'UNAUTHENTICATED', status: 401 })),
  'Your session has ended. Please sign in again.',
);

let getAttempts = 0;
const retryingClient = new HttpClient({
  baseUrl: 'https://example.invalid/api',
  fetchImplementation: async () => {
    getAttempts += 1;
    return getAttempts === 1
      ? new Response(JSON.stringify({ error: { code: 'TEMPORARY', message: 'Temporarily unavailable.' } }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.deepEqual(await retryingClient.get('/queue'), { ok: true });
assert.equal(getAttempts, 2, 'safe GET requests should retry one transient failure');

let postAttempts = 0;
const nonRetryingClient = new HttpClient({
  baseUrl: 'https://example.invalid/api',
  fetchImplementation: async () => {
    postAttempts += 1;
    return new Response(JSON.stringify({ error: { code: 'TEMPORARY', message: 'Temporarily unavailable.' } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  },
});
await assert.rejects(() => nonRetryingClient.post('/orders', { reference: 'TEST' }), ServiceError);
assert.equal(postAttempts, 1, 'state-changing requests must not retry unless protected by an explicit higher-level idempotency flow');

console.log('Date validation, public errors and safe network retry tests passed.');
