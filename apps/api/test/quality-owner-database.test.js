import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/security/crypto.js';

test('QA options/actions and Owner aggregates work through migrated runtime RLS', { timeout: 120000 }, async t => {
  const url = process.env.RHOMBERG_TEST_QA_DATABASE_URL;
  if (url) { const parsed = new URL(url); assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname)); assert.match(parsed.pathname, /^\/rhomberg_qa_test_[a-z0-9_]+$/); }
  const db = url ? new pg.Client({ connectionString: url }) : new PGlite();
  if (url) await db.connect();
  t.after(async () => { if (url) await db.end(); else await db.close(); });
  await runMigrations(db); await runMigrations(db);
  const q = (sql, values) => db.query(sql, values);
  assert.equal(Number((await q('SELECT count(*) FROM app.users')).rows[0].count), 0);
  const password = 'Fabricated-QA-Owner-Only!739', pepper = 'fabricated-qa-owner-session-pepper-32-characters';
  const hash = await hashPassword(password);
  const ids = Object.fromEntries(['owner', 'salesManager', 'qa', 'manager', 'customer', 'otherCustomer', 'companyA', 'companyB', 'order', 'otherOrder', 'line', 'otherLine'].map(key => [key, randomUUID()]));
  for (const [key, role] of [['owner', 'company_owner'], ['salesManager', 'sales_manager'], ['qa', 'quality_assurance'], ['manager', 'quality_manager'], ['customer', 'customer'], ['otherCustomer', 'customer']]) {
    await q("INSERT INTO app.users(id,username,email,display_name,password_hash,identity_provider,status) VALUES($1,$2,$3,$2,$4,'local_password','active')", [ids[key], 'fabricated-' + key, key.toLowerCase() + '@example.invalid', hash]);
    await q('INSERT INTO app.user_roles(user_id,role_code) VALUES($1,$2)', [ids[key], role]);
  }
  for (const key of ['companyA', 'companyB']) await q("INSERT INTO app.companies(id,name,area,industry) VALUES($1,$2,'Western Cape','Fabricated')", [ids[key], 'Fabricated ' + key]);
  await q('INSERT INTO app.company_users(company_id,user_id,is_primary) VALUES($1,$2,true),($3,$4,true)', [ids.companyA, ids.customer, ids.companyB, ids.otherCustomer]);
  await q("INSERT INTO app.products(id,code,name) VALUES('fabricated-qa-product','UAT-QA','Fabricated QA Product')");
  for (const [order, line, company, customer] of [['order','line','companyA','customer'], ['otherOrder','otherLine','companyB','otherCustomer']]) {
    await q("INSERT INTO app.orders(id,reference,company_id,customer_user_id,origin,status,application,fulfilment,created_by_user_id) VALUES($1,$2,$3,$4,'representative_loaded_order','awaiting_qa','Fabricated QA requirement','collect',$5)", [ids[order], 'FABRICATED-' + order, ids[company], ids[customer], ids.owner]);
    await q("INSERT INTO app.order_items(id,order_id,line_number,product_id,product_code_snapshot,product_name_snapshot,quantity) VALUES($1,$2,1,'fabricated-qa-product','UAT-QA','Fabricated QA Product',3)", [ids[line], ids[order]]);
  }
  // Reporting must not silently stop at the 200-row workspace page limit.
  await q("INSERT INTO app.orders(id,reference,company_id,origin,status,application,fulfilment,created_by_user_id) SELECT gen_random_uuid(),'FABRICATED-COMPLETED-'||n,$1,'representative_loaded_order','completed','Fabricated archived history','collect',$2 FROM generate_series(1,205) n", [ids.companyB, ids.owner]);
  await q("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='qa_reporting_runtime') THEN CREATE ROLE qa_reporting_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $$");
  const runtime = (await q("SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='qa_reporting_runtime'")).rows[0];
  assert.ok(Object.values(runtime).every(value => value === false), 'Disposable runtime role must remain unprivileged');
  const source = await fs.readFile(new URL('../sql/phase1-runtime-grants.sql', import.meta.url), 'utf8');
  const databaseName = (await q('SELECT current_database() AS name')).rows[0].name;
  const grants = source.slice(source.indexOf('REVOKE ALL ON SCHEMA'), source.indexOf('-- Resolve each exact approved signature')).replaceAll(':"runtime_role"', '"qa_reporting_runtime"').replaceAll(':"DBNAME"', '"' + databaseName.replaceAll('"', '""') + '"');
  for (const statement of grants.split(';').filter(value => value.trim())) { if (!url && /GRANT CONNECT ON DATABASE/.test(statement)) continue; await q(statement); }
  for (const match of source.slice(0, source.indexOf('missing_signatures text[]')).matchAll(/'(app\.[^']+\([^']*\))'/g)) await q('GRANT EXECUTE ON FUNCTION ' + match[1] + ' TO qa_reporting_runtime');
  await q('SET ROLE qa_reporting_runtime');
  // Serialize transactions for the single PGlite/client connection, like a
  // size-one production pool; do not interleave request contexts.
  let pending = Promise.resolve();
  const pool = { query: q, connect: async () => { const before = pending; let release; pending = new Promise(resolve => { release = resolve; }); await before; return { query: q, release }; } };
  const repository = createPostgresRepository(pool);
  const logs = [];
  const app = await buildApp({ config: { environment: 'test', host: '127.0.0.1', port: 0, logLevel: 'info', trustProxy: false, cookieSecure: false, cookieName: 'qa_test_session', sessionTtlSeconds: 3600, sessionPepper: pepper, maxUploadBytes: 4194304, allowedOrigins: [], identityMode: 'local_password' }, repository, storage: createMemoryPrivateStorage(), logStream: new Writable({ write(chunk, _encoding, callback) { logs.push(chunk.toString()); callback(); } }) });
  t.after(() => app.close());
  const signIn = async key => { const result = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: 'fabricated-' + key, password } }); assert.equal(result.statusCode, 200, result.body); return { cookie: result.headers['set-cookie'].split(';')[0], 'x-csrf-token': result.json().data.csrfToken }; };
  const owner = await signIn('owner'), qa = await signIn('qa'), manager = await signIn('manager'), customer = await signIn('customer');
  const salesManager = await signIn('salesManager');
  for (const headers of [owner, salesManager]) {
    const options = await app.inject({ url: '/api/v1/management/performance-report-options', headers });
    assert.equal(options.statusCode, 200, options.body);
    assert.ok(options.json().data.sections.length > 0);
    const dashboard = await app.inject({ url: '/api/v1/management/dashboard', headers });
    assert.equal(dashboard.statusCode, 200, dashboard.body);
    assert.equal(dashboard.json().data.period.mode, 'last_31_days');
    const report = await app.inject({ method: 'POST', url: '/api/v1/management/performance-reports', headers, payload: { periodMode: 'last_31_days', sections: ['executive_summary','operational_records'] } });
    assert.equal(report.statusCode, 200, report.body);
    assert.equal(Buffer.from(report.json().data.bytesBase64, 'base64').subarray(0, 4).toString(), '%PDF');
    assert.deepEqual(report.json().data.period, dashboard.json().data.period);
    const audit = (await app.inject({ url: '/api/v1/audit-events', headers: owner })).json().data.find(event => event.eventType === 'management.pdf_exported');
    assert.deepEqual(audit.details.period, report.json().data.period);
    assert.equal(audit.details.recordCount, dashboard.json().data.records.length);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/management/performance-reports', headers: customer, payload: {} })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/management/performance-reports', headers: { cookie: owner.cookie }, payload: {} })).statusCode, 403);
  for (const headers of [qa, manager]) {
    const options = await app.inject({ url: '/api/v1/quality-assurance/workspace-options', headers }); assert.equal(options.statusCode, 200, options.body);
    assert.ok(Object.values(options.json().data).every(choices => choices.every(choice => choice.id && choice.label)));
    const queue = await app.inject({ url: '/api/v1/quality-assurance/orders', headers }); assert.equal(queue.statusCode, 200, queue.body); assert.equal(queue.json().data.length, 2);
  }
  const perform = (headers, action, data = {}) => app.inject({ method: 'POST', url: '/api/v1/orders/' + ids.order + '/workflow-actions', headers, payload: { action, data } });
  assert.equal((await perform(owner, 'start_qa')).statusCode, 403, 'Owner is read-only');
  assert.equal((await perform(customer, 'start_qa')).statusCode, 403);
  assert.equal((await perform(qa, 'start_qa')).statusCode, 200);
  const failure = { category: 'physical_damage', severity: 'major', reworkDestination: 'expediting', affectedItemId: ids.line, dateFound: '2026-08-27', problemDescription: 'Fabricated QA finding', customerMessage: 'Your order is undergoing quality review.', internalNote: 'QA-INTERNAL-SENTINEL' };
  assert.equal((await perform(qa, 'fail_qa', { qaFailure: { ...failure, category: 'not-approved' } })).statusCode, 422);
  assert.equal((await perform(qa, 'fail_qa', { qaFailure: { ...failure, affectedItemId: ids.otherLine } })).statusCode, 422);
  const failed = await perform(qa, 'fail_qa', { qaFailure: failure }); assert.equal(failed.statusCode, 200, failed.body);
  const detail = await app.inject({ url: '/api/v1/orders/' + ids.order, headers: manager }); assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().data.qualityAssurance.inspections[0].category, 'physical_damage');
  const customerDetail = await app.inject({ url: '/api/v1/orders/' + ids.order, headers: customer }); assert.equal(customerDetail.statusCode, 200, customerDetail.body); assert.doesNotMatch(customerDetail.body, /QA-INTERNAL-SENTINEL/);
  assert.equal((await app.inject({ url: '/api/v1/orders/' + ids.otherOrder, headers: customer })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/v1/management/dashboard', headers: customer })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/v1/management/dashboard', headers: qa })).statusCode, 403);
  const dashboard = await app.inject({ url: '/api/v1/management/dashboard', headers: owner }); assert.equal(dashboard.statusCode, 200, dashboard.body);
  const report = dashboard.json().data;
  assert.equal(report.phase21.operations.totalOrders, 207);
  assert.equal(report.metrics.completed, 205);
  assert.equal(report.phase21.products.totalUnits, 6);
  assert.equal(report.phase21.products.byCompany.length, 2);
  assert.equal(report.phase21.quality.failureCount, 1);
  assert.ok(report.recentActivity.some(event => event.eventType === 'workflow.transition' && event.action === 'fail_qa'));
  const notifications = await app.inject({ url: '/api/v1/notifications', headers: customer }); assert.ok(notifications.json().data.some(item => item.message === failure.customerMessage));
  const ownerMe = await app.inject({ url: '/api/v1/auth/me', headers: owner }); const permissions = ownerMe.json().data.permissions;
  assert.ok(permissions.includes('view_all_rfqs') && permissions.includes('view_reports'));
  assert.ok(!permissions.includes('administer_users') && !permissions.includes('override_workflow'));
  assert.equal((await perform(manager, 'release_qa_order')).statusCode, 409, 'Cannot release a failed inspection');
  for (const action of ['start_qa_rework', 'resubmit_to_qa', 'start_qa_reinspection']) {
    const result = await perform(manager, action, { qaRework: { customerMessage: 'Your order is being checked again.' } });
    assert.equal(result.statusCode, 200, result.body);
  }
  const passed = await perform(manager, 'pass_qa', { qaPass: { inspectionDate: '2026-08-27', checklistConfirmed: true, meetsRequirements: true, customerMessage: 'Your order passed its quality checks.' } });
  assert.equal(passed.statusCode, 200, passed.body);
  const released = await perform(manager, 'release_qa_order'); assert.equal(released.statusCode, 200, released.body);
  const revised = (await app.inject({ url: '/api/v1/orders/' + ids.order, headers: manager })).json().data;
  assert.equal(revised.trackingStatus, 'awaiting_dispatch');
  assert.deepEqual(revised.qualityAssurance.inspections.map(item => [item.result, item.attempt]), [['failed', 1], ['passed', 2]]);
  assert.equal(revised.qualityAssurance.reworkCycle, 1);
  const updatedReport = (await app.inject({ url: '/api/v1/management/dashboard', headers: owner })).json().data;
  assert.equal(updatedReport.phase21.quality.passRate, 50);
  assert.equal(updatedReport.phase21.quality.reworkCycles, 1);
  await assert.rejects(q("INSERT INTO app.role_permissions VALUES('company_owner','administer_users')"), error => error.code === '42501');
  assert.doesNotMatch(logs.join(''), new RegExp(password + '|' + hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|QA-INTERNAL-SENTINEL'));
  assert.equal((await app.inject({ url: '/api/v1/management/dashboard' })).statusCode, 401);
});
