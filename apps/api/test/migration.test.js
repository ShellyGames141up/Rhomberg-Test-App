import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '../src/db/migrate.js';

test('Phase 1 migration applies to an empty PostgreSQL-compatible database with required constraints and indexes', async () => {
  const db = new PGlite();
  await runMigrations(db);
  await runMigrations(db);
  const migrationRecords = await db.query('SELECT version FROM public.rhomberg_schema_migrations');
  assert.deepEqual(migrationRecords.rows.map(row => row.version).sort(), ['001_phase1_vertical_slice.sql', '002_protected_request_context.sql', '003_initial_administrator_bootstrap.sql', '004_internal_test_operational_foundation.sql', '005_approved_product_catalogue.sql', '006_account_directory_fields.sql', '007_simplified_laboratory_access.sql', '008_administration_lifecycle.sql', '009_document_and_governance_fields.sql', '010_client_visits.sql', '011_workspace_and_record_controls.sql', '012_administration_directory_scope.sql', '013_first_login_password_change.sql', '014_customer_registration_and_dedicated_representative.sql', '015_administrator_account_soft_delete.sql', '016_conditional_product_configuration.sql', '017_restore_customer_lifecycle_functions.sql']);
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'app'");
  const names = new Set(tables.rows.map(row => row.tablename));
  for (const required of ['companies', 'users', 'roles', 'permissions', 'user_roles', 'company_users', 'sessions', 'rfqs', 'rfq_items', 'document_metadata', 'audit_events', 'notifications', 'idempotency_records', 'request_security_contexts', 'platform_bootstrap_state', 'user_settings', 'notification_preferences', 'enquiry_drafts', 'orders', 'order_items', 'workflow_events', 'technical_support_requests', 'technical_support_messages', 'locations', 'platform_policies', 'user_permission_grants', 'user_profile_images', 'client_appointments', 'catalogue_overrides']) assert.equal(names.has(required), true, `missing ${required}`);
  const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'app'");
  assert.equal(indexes.rows.some(row => row.indexname === 'rfqs_company_created_idx'), true);
  assert.equal(indexes.rows.some(row => row.indexname === 'sessions_active_token_idx'), true);
  assert.equal(indexes.rows.some(row => row.indexname === 'representative_company_one_active_idx'), true);
  assert.equal(indexes.rows.some(row => row.indexname === 'companies_active_name_ci_uq'), true);
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
  const passwordFunction = await db.query("SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pg_proc.pronamespace WHERE nspname='app' AND proname='change_own_password'");
  assert.equal(passwordFunction.rows.length, 1);
  const registrationFunction = await db.query("SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pg_proc.pronamespace WHERE nspname='app' AND proname='register_customer_account'");
  assert.equal(registrationFunction.rows.length, 1);
  const representativeResolutionFunction = await db.query("SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pg_proc.pronamespace WHERE nspname='app' AND proname='resolve_rfq_representative'");
  assert.equal(representativeResolutionFunction.rows.length, 1);
  const deleteFunction = await db.query("SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pg_proc.pronamespace WHERE nspname='app' AND proname='soft_delete_user'");
  assert.equal(deleteFunction.rows.length, 1);
  const catalogue = await db.query('SELECT count(*)::integer AS count FROM app.products WHERE is_active');
  assert.equal(catalogue.rows[0].count, 84);
  const pbb = await db.query("SELECT configuration_schema FROM app.products WHERE code='PBB'");
  const customRange = pbb.rows[0].configuration_schema.find(field => field.key === 'customRange');
  assert.deepEqual(customRange.showWhen, { key: 'range', value: 'Custom range - sales review' });
  await db.close();
});

test('first-login database function clears only the authenticated user flag, audits safely and revokes sessions', async () => {
  const db = new PGlite();
  await runMigrations(db);
  const userId = '20000000-0000-4000-8000-000000000077';
  const tokenHash = '7'.repeat(64);
  const csrfHash = '8'.repeat(64);
  const passwordHash = `scrypt$32768$8$1$${'a'.repeat(22)}$${'b'.repeat(86)}`;
  await db.query(`INSERT INTO app.users(id,username,email,display_name,password_hash,identity_provider,status,must_change_password)
    VALUES($1,'fabricated-migration-user','migration.user@example.invalid','Fabricated Migration User',$2,'local_password','active',true)`, [userId, passwordHash]);
  await db.query("INSERT INTO app.user_roles(user_id,role_code) VALUES($1,'planning')", [userId]);
  await db.query(`INSERT INTO app.sessions(id,user_id,token_hash,csrf_token_hash,expires_at)
    VALUES('30000000-0000-4000-8000-000000000077',$1,$2,$3,now()+interval '1 day')`, [userId, tokenHash, csrfHash]);
  await db.exec('BEGIN');
  await db.query('SELECT app.establish_request_context($1)', [tokenHash]);
  await db.query('SELECT app.change_own_password($1,$2)', [passwordHash, 'fabricated-correlation']);
  await db.exec('COMMIT');
  const user = await db.query('SELECT must_change_password FROM app.users WHERE id=$1', [userId]);
  assert.equal(user.rows[0].must_change_password, false);
  const session = await db.query('SELECT revoked_at IS NOT NULL AS revoked FROM app.sessions WHERE user_id=$1', [userId]);
  assert.equal(session.rows[0].revoked, true);
  const audit = await db.query("SELECT event_type,details::text AS details FROM app.audit_events WHERE actor_user_id=$1", [userId]);
  assert.equal(audit.rows[0].event_type, 'authentication.password_changed');
  assert.equal(audit.rows[0].details.includes(passwordHash), false);
  await db.close();
});

test('migration 017 restores customer lifecycle functions on a drifted recorded schema', async () => {
  const db = new PGlite();
  await runMigrations(db);
  await db.exec(`
    DROP FUNCTION app.register_customer_account(uuid,uuid,text,text,text,text,text,text,text,text,text);
    DROP FUNCTION app.resolve_rfq_representative(uuid,uuid,text);
    DROP FUNCTION app.soft_delete_user(uuid,text,text);
    DELETE FROM public.rhomberg_schema_migrations
    WHERE version='017_restore_customer_lifecycle_functions.sql';
  `);
  await runMigrations(db);
  const restored = await db.query(`SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app'
      AND p.proname IN ('register_customer_account','resolve_rfq_representative','soft_delete_user')
    ORDER BY proname`);
  assert.deepEqual(restored.rows.map(row => row.proname), [
    'register_customer_account',
    'resolve_rfq_representative',
    'soft_delete_user',
  ]);
  await db.close();
});
