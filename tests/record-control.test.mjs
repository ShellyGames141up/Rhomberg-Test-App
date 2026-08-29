import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApiServices } from '../src/services/api/createApiServices.js';
import { navigationItemsForRole } from '../src/domain/accessControl.js';
import { PERMISSIONS, permissionsForRole, USER_ROLES } from '../src/services/contracts.js';

const requests = [];
const services = createApiServices({
  apiBaseUrl: '/api/v1',
  fetchImplementation: async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ data: { status: 'deleted' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});

await services.administration.deleteAccount('account-id', { reason: 'Fabricated account removal reason.' });
await services.recordControl.deleteRecord('order', 'order-id', { reason: 'Fabricated order removal reason.' });

assert.equal(requests[0].options.method, 'DELETE');
assert.deepEqual(JSON.parse(requests[0].options.body), { reason: 'Fabricated account removal reason.' }, 'account deletion must send the reason as the JSON request body');
assert.equal(requests[1].options.method, 'DELETE');
assert.deepEqual(JSON.parse(requests[1].options.body), { reason: 'Fabricated order removal reason.' }, 'record deletion must send the reason as the JSON request body');

assert.ok(navigationItemsForRole(USER_ROLES.ADMINISTRATOR).some(item => item.id === 'records'));
assert.ok(navigationItemsForRole(USER_ROLES.PLANNING).some(item => item.id === 'records'));
assert.ok(permissionsForRole(USER_ROLES.PLANNING).includes(PERMISSIONS.DELETE_OPERATIONAL_RECORDS));

const dock = readFileSync('src/components/RecordsControlDock.jsx', 'utf8');
assert.match(dock, /PLANNING_STATUSES = new Set\(\['awaiting_planning', 'planning_in_progress', 'planned'\]\)/);
assert.match(dock, /This is a soft deletion/);
assert.match(dock, /reason\.trim\(\)\.length < 8/);

const migration = readFileSync('apps/api/migrations/026_controlled_operational_record_deletion.sql', 'utf8');
assert.match(migration, /CREATE FUNCTION app\.soft_delete_operational_record/);
assert.match(migration, /Planning may remove only records still in the Planning queue/);
assert.match(migration, /INSERT INTO app\.audit_events/);
assert.match(migration, /'hardDeleted',false/);
assert.match(migration, /legalHold/);

console.log('Controlled account and operational-record deletion coverage passed.');
