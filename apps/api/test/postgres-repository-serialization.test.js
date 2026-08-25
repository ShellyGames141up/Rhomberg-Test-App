import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'administrator',
  roles: ['administrator'],
  permissions: ['administer_users', 'view_all_orders'],
  databaseSessionTokenHash: 'fabricated-session-hash',
};

function createSerialOnlyPool() {
  let activeQueries = 0;
  let maximumConcurrentQueries = 0;
  const statements = [];

  const client = {
    async query(statement) {
      if (activeQueries) throw new Error('A single PostgreSQL client was queried concurrently.');
      activeQueries += 1;
      maximumConcurrentQueries = Math.max(maximumConcurrentQueries, activeQueries);
      statements.push(String(statement));
      try {
        await new Promise(resolve => setImmediate(resolve));
        if (String(statement).includes('establish_request_context')) return { rows: [{ user_id: actor.id }] };
        if (String(statement).includes('count(*)::integer AS count FROM app.audit_events')) return { rows: [{ count: 0 }] };
        return { rows: [] };
      } finally {
        activeQueries -= 1;
      }
    },
    release() {},
  };

  return {
    pool: { async connect() { return client; } },
    statements,
    get maximumConcurrentQueries() { return maximumConcurrentQueries; },
  };
}

test('PostgreSQL repository serialises all work performed on one transaction client', async () => {
  const serialOnly = createSerialOnlyPool();
  const repository = createPostgresRepository(serialOnly.pool);

  const overview = await repository.getAdministrationOverview(actor);
  assert.equal(overview.summary.users, 0);

  const orderOptions = await repository.getRepresentativeOrderOptions(actor);
  assert.deepEqual(orderOptions, { companies: [], contacts: [], representatives: [] });

  assert.deepEqual(await repository.listOrders(actor), []);
  assert.deepEqual(await repository.listCatalogueOverrides(actor), []);
  assert.equal(serialOnly.maximumConcurrentQueries, 1);
  assert.ok(serialOnly.statements.some(statement => statement.includes('catalogue_overrides')));
});
