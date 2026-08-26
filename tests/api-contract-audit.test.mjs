import assert from 'node:assert/strict';
import test from 'node:test';
import { auditRepositoryContract } from '../scripts/audit-api-contract.mjs';

test('API contract audit covers every active API-mode frontend contract', async () => {
  const audit = await auditRepositoryContract();
  const status = new Map(audit.matrix.map(route => [`${route.method} ${route.path}`, route.status]));
  for (const route of [
    'GET /auth/csrf-token',
    'GET /auth/me',
    'POST /auth/login',
    'POST /auth/register',
    'GET /products/categories',
    'GET /products',
    'GET /products/recommendations',
    'GET /reference-data/registration',
    'GET /enquiries/options',
    'GET /enquiries',
    'GET /orders',
    'GET /notifications',
    'GET /users/me/notification-preferences',
    'GET /users/me/settings',
    'GET /administration/overview',
    'DELETE /admin/users/:accountId',
  ]) assert.equal(status.get(route), 'implemented', route);
  assert.deepEqual(audit.matrix.filter(route => route.status !== 'implemented'), [], 'active API-mode contracts must have matching backend routes');
  assert.equal(status.get('POST /auth/register'), 'implemented', 'customer registration must use the server-backed staging contract');
  assert.equal([...status.keys()].some(route => route.includes('/credential-changes/')), false, 'email-dependent self-service credential changes must remain hidden until the approved identity integration exists');
});
