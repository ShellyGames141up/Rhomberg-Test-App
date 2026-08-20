import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '../src/db/migrate.js';

test('Phase 1 migration applies to an empty PostgreSQL-compatible database with required constraints and indexes', async () => {
  const db = new PGlite();
  await runMigrations(db);
  await runMigrations(db);
  const migrationRecords = await db.query('SELECT version FROM public.rhomberg_schema_migrations');
  assert.deepEqual(migrationRecords.rows.map(row => row.version).sort(), ['001_phase1_vertical_slice.sql', '002_protected_request_context.sql']);
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'app'");
  const names = new Set(tables.rows.map(row => row.tablename));
  for (const required of ['companies', 'users', 'roles', 'permissions', 'user_roles', 'company_users', 'sessions', 'rfqs', 'rfq_items', 'document_metadata', 'audit_events', 'notifications', 'idempotency_records', 'request_security_contexts']) assert.equal(names.has(required), true, `missing ${required}`);
  const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'app'");
  assert.equal(indexes.rows.some(row => row.indexname === 'rfqs_company_created_idx'), true);
  assert.equal(indexes.rows.some(row => row.indexname === 'sessions_active_token_idx'), true);
  const rls = await db.query("SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace WHERE nspname='app' AND relname IN ('rfqs','document_metadata')");
  assert.equal(rls.rows.every(row => row.relrowsecurity), true);
  await db.close();
});
