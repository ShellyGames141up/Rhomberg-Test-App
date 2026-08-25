import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '../src/db/migrate.js';

test('Phase 1 migration applies to an empty PostgreSQL-compatible database with required constraints and indexes', async () => {
  const db = new PGlite();
  await runMigrations(db);
  await runMigrations(db);
  const migrationRecords = await db.query('SELECT version FROM public.rhomberg_schema_migrations');
  assert.deepEqual(migrationRecords.rows.map(row => row.version).sort(), ['001_phase1_vertical_slice.sql', '002_protected_request_context.sql', '003_initial_administrator_bootstrap.sql', '004_internal_test_operational_foundation.sql', '005_approved_product_catalogue.sql', '006_account_directory_fields.sql', '007_simplified_laboratory_access.sql', '008_administration_lifecycle.sql', '009_document_and_governance_fields.sql', '010_client_visits.sql', '011_workspace_and_record_controls.sql', '012_administration_directory_scope.sql']);
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'app'");
  const names = new Set(tables.rows.map(row => row.tablename));
  for (const required of ['companies', 'users', 'roles', 'permissions', 'user_roles', 'company_users', 'sessions', 'rfqs', 'rfq_items', 'document_metadata', 'audit_events', 'notifications', 'idempotency_records', 'request_security_contexts', 'platform_bootstrap_state', 'user_settings', 'notification_preferences', 'enquiry_drafts', 'orders', 'order_items', 'workflow_events', 'technical_support_requests', 'technical_support_messages', 'locations', 'platform_policies', 'user_permission_grants', 'user_profile_images', 'client_appointments', 'catalogue_overrides']) assert.equal(names.has(required), true, `missing ${required}`);
  const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'app'");
  assert.equal(indexes.rows.some(row => row.indexname === 'rfqs_company_created_idx'), true);
  assert.equal(indexes.rows.some(row => row.indexname === 'sessions_active_token_idx'), true);
  const rls = await db.query("SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace WHERE nspname='app' AND relname IN ('rfqs','document_metadata')");
  assert.equal(rls.rows.every(row => row.relrowsecurity), true);
  const operationalCounts = await db.query(`SELECT
    (SELECT count(*) FROM app.users) AS users,
    (SELECT count(*) FROM app.companies) AS companies,
    (SELECT count(*) FROM app.rfqs) AS rfqs,
    (SELECT count(*) FROM app.rfq_items) AS items,
    (SELECT count(*) FROM app.document_metadata) AS documents,
    (SELECT count(*) FROM app.notifications) AS notifications,
    (SELECT count(*) FROM app.audit_events) AS audits,
    (SELECT count(*) FROM app.platform_bootstrap_state) AS bootstrap_records`);
  assert.deepEqual(operationalCounts.rows[0], { users: 0, companies: 0, rfqs: 0, items: 0, documents: 0, notifications: 0, audits: 0, bootstrap_records: 0 });
  const permission = await db.query("SELECT 1 FROM app.role_permissions WHERE role_code = 'administrator' AND permission_code = 'administer_users'");
  assert.equal(permission.rows.length, 1);
  const catalogue = await db.query('SELECT count(*)::integer AS count FROM app.products WHERE is_active');
  assert.equal(catalogue.rows[0].count, 84);
  await db.close();
});
