import assert from 'node:assert/strict';
import test from 'node:test';
import { auditRepositoryContract } from '../scripts/audit-api-contract.mjs';

test('API contract audit covers startup and authenticated Administrator bootstrap routes', async () => {
  const audit = await auditRepositoryContract();
  const status = new Map(audit.matrix.map(route => [`${route.method} ${route.path}`, route.status]));
  for (const route of [
    'GET /auth/csrf-token',
    'GET /auth/me',
    'POST /auth/login',
    'GET /products/categories',
    'GET /products',
    'GET /products/recommendations',
    'GET /reference-data/registration',
    'GET /enquiries',
    'GET /orders',
    'GET /notifications',
    'GET /users/me/notification-preferences',
    'GET /users/me/settings',
    'GET /administration/overview',
  ]) assert.equal(status.get(route), 'implemented', route);
  assert.ok(audit.frontendRoutes.length > audit.apiBackendRoutes.length, 'the audit must continue to report later Phase 1 contract gaps');
});
