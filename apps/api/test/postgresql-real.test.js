import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import test from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { hashPassword, hashSessionToken } from '../src/security/crypto.js';

const { Pool } = pg;
const migrationUrl = process.env.RHOMBERG_TEST_POSTGRES_MIGRATION_URL;
const runtimeUrl = process.env.RHOMBERG_TEST_POSTGRES_RUNTIME_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);
const PASSWORD = 'Fabricated-PostgreSQL-Test-Password!';
const PEPPER = 'fabricated-real-postgresql-test-pepper-32-plus';
const ids = Object.freeze({
  companyA: '71000000-0000-4000-8000-000000000001', companyB: '71000000-0000-4000-8000-000000000002',
  customerA: '72000000-0000-4000-8000-000000000001', customerB: '72000000-0000-4000-8000-000000000002',
  disabled: '72000000-0000-4000-8000-000000000003', repUserA: '72000000-0000-4000-8000-000000000004',
  repUserB: '72000000-0000-4000-8000-000000000005', repA: '73000000-0000-4000-8000-000000000001',
  repB: '73000000-0000-4000-8000-000000000002',
});

const config = Object.freeze({
  environment: 'test', host: '127.0.0.1', port: 0, logLevel: 'silent', trustProxy: false,
  cookieSecure: false, cookieName: 'rhomberg_pg_test_session', sessionTtlSeconds: 3600,
  sessionPepper: PEPPER, maxUploadBytes: 4 * 1024 * 1024, allowedOrigin: '', devIdentityEnabled: true,
  shutdownTimeoutMs: 1000,
});

async function seed(client) {
  const passwordHash = await hashPassword(PASSWORD);
  await client.query(`TRUNCATE app.request_security_contexts, app.idempotency_records, app.notifications,
    app.document_metadata, app.audit_events, app.rfq_items, app.rfqs, app.sessions,
    app.representative_company_assignments, app.representatives, app.company_users,
    app.user_roles, app.users, app.companies, app.products RESTART IDENTITY CASCADE`);
  await client.query(`INSERT INTO app.companies (id,name,area,industry) VALUES
    ($1,'Fabricated PostgreSQL Company A','Test A','Fabricated'),
    ($2,'Fabricated PostgreSQL Company B','Test B','Fabricated')`, [ids.companyA, ids.companyB]);
  await client.query(`INSERT INTO app.users (id,email,display_name,password_hash,status,disabled_at) VALUES
    ($1,'pg.customer.a@example.invalid','Fabricated PostgreSQL Customer A',$6,'active',NULL),
    ($2,'pg.customer.b@example.invalid','Fabricated PostgreSQL Customer B',$6,'active',NULL),
    ($3,'pg.disabled@example.invalid','Fabricated Disabled Customer',$6,'disabled',now()),
    ($4,'pg.rep.a@example.invalid','Fabricated Representative A',$6,'active',NULL),
    ($5,'pg.rep.b@example.invalid','Fabricated Representative B',$6,'active',NULL)`,
  [ids.customerA, ids.customerB, ids.disabled, ids.repUserA, ids.repUserB, passwordHash]);
  await client.query(`INSERT INTO app.user_roles (user_id,role_code) VALUES
    ($1,'customer'),($2,'customer'),($3,'customer'),($4,'sales_representative'),($5,'sales_representative')`,
  [ids.customerA, ids.customerB, ids.disabled, ids.repUserA, ids.repUserB]);
  await client.query(`INSERT INTO app.company_users (company_id,user_id,is_primary) VALUES
    ($1,$3,true),($2,$4,true),($1,$5,true)`, [ids.companyA, ids.companyB, ids.customerA, ids.customerB, ids.disabled]);
  await client.query(`INSERT INTO app.representatives (id,user_id,display_name,branch_name) VALUES
    ($1,$3,'Fabricated Representative A','Fabricated Branch A'),
    ($2,$4,'Fabricated Representative B','Fabricated Branch B')`, [ids.repA, ids.repB, ids.repUserA, ids.repUserB]);
  await client.query(`INSERT INTO app.representative_company_assignments (representative_id,company_id) VALUES
    ($1,$3),($2,$4)`, [ids.repA, ids.repB, ids.companyA, ids.companyB]);
  await client.query(`INSERT INTO app.products (id,code,name,configuration_schema) VALUES
    ('pg-pressure-gauge','PG-DEMO','Fabricated PostgreSQL pressure gauge','[{"key":"dialSize","required":true}]'::jsonb),
    ('pg-temperature-gauge','TG-DEMO','Fabricated PostgreSQL temperature gauge','[{"key":"stemLength","required":true}]'::jsonb)`);
}

const payload = representativeId => ({
  details: { application: 'Fabricated PostgreSQL clean-water monitoring', medium: 'Fabricated water', area: 'Fabricated Region', selectedRep: { id: representativeId }, fulfilment: 'delivery', deliveryAddress: '1 Fabricated PostgreSQL Road', notes: 'Fabricated test only.' },
  items: [{ lineId: randomUUID(), productId: 'pg-pressure-gauge', quantity: 2, configuration: { dialSize: '100 mm' } }],
});

async function login(app, email, password = PASSWORD) {
  const lastOctet = ({
    'pg.customer.a@example.invalid': 11, 'pg.customer.b@example.invalid': 12,
    'pg.disabled@example.invalid': 13, 'pg.rep.a@example.invalid': 14,
  })[email] || 15;
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: `127.0.0.${lastOctet}`, payload: { email, password } });
  const body = response.json();
  return { response, body, cookie: response.headers['set-cookie']?.split(';')[0] || '', token: response.headers['set-cookie']?.split(';')[0]?.split('=')[1] || '', csrf: body.data?.csrfToken };
}

const create = (app, auth, body, key) => app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf, 'idempotency-key': key }, payload: body });

test('real PostgreSQL Phase 1 vertical slice and database security controls', { skip: !enabled, timeout: 120000 }, async t => {
  const migrationPool = new Pool({ connectionString: migrationUrl, max: 3 });
  const runtimePool = new Pool({ connectionString: runtimeUrl, max: 8 });
  const migrationClient = await migrationPool.connect();
  await seed(migrationClient);
  migrationClient.release();
  const repository = createPostgresRepository(runtimePool);
  const storage = createMemoryPrivateStorage();
  const app = await buildApp({ config, repository, storage, logger: false });
  t.after(async () => { await app.close(); await migrationPool.end(); });

  await t.test('authentication, CSRF, expiry, revocation and disabled users', async () => {
    const auth = await login(app, 'pg.customer.a@example.invalid');
    assert.equal(auth.response.statusCode, 200, auth.response.body);
    assert.ok(auth.cookie); assert.ok(auth.csrf);
    const stored = await migrationPool.query('SELECT token_hash, csrf_token_hash FROM app.sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [ids.customerA]);
    assert.equal(stored.rows[0].token_hash, hashSessionToken(auth.token, PEPPER));
    assert.notEqual(stored.rows[0].token_hash, auth.token);
    assert.notEqual(stored.rows[0].csrf_token_hash, auth.csrf);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: auth.cookie, 'idempotency-key': 'missing-csrf-key' }, payload: payload(ids.repA) })).statusCode, 403);

    await migrationPool.query("UPDATE app.sessions SET created_at=now()-interval '2 hours', expires_at=now()-interval '1 second' WHERE token_hash=$1", [hashSessionToken(auth.token, PEPPER)]);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: auth.cookie } })).statusCode, 401);
    const fresh = await login(app, 'pg.customer.a@example.invalid');
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: fresh.cookie, 'x-csrf-token': fresh.csrf } })).statusCode, 204);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: fresh.cookie } })).statusCode, 401);
    assert.equal((await login(app, 'pg.disabled@example.invalid')).response.statusCode, 401);
  });

  const authA = await login(app, 'pg.customer.a@example.invalid');
  const authB = await login(app, 'pg.customer.b@example.invalid');
  assert.equal(authA.response.statusCode, 200, authA.response.body); assert.equal(authB.response.statusCode, 200, authB.response.body);
  assert.ok(authA.body.data.user.permissions.includes('create_rfq'), JSON.stringify(authA.body.data.user));

  let enquiryA; let documentA;
  await t.test('RFQ, line item, document metadata, audit and notification commit atomically', async () => {
    const boundary = '----fabricated-postgresql-boundary';
    const multipart = Buffer.from([
      `--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(payload(ids.repA))}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="purchaseOrder"; filename="fabricated-pg-document.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 fabricated PostgreSQL test only\r\n`,
      `--${boundary}--\r\n`,
    ].join(''));
    const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: authA.cookie, 'x-csrf-token': authA.csrf, 'idempotency-key': 'pg-document-transaction-key', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: multipart });
    assert.equal(response.statusCode, 201, response.body);
    enquiryA = response.json().data.enquiry; documentA = enquiryA.documents[0];
    assert.match(enquiryA.reference, /^RQ-\d{4}-\d{6}$/);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.rfq_items WHERE rfq_id=$1', [enquiryA.id])).rows[0].n, 1);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE entity_id=$1 AND event_type='rfq.created'", [enquiryA.id])).rows[0].n, 1);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.notifications WHERE rfq_id=$1', [enquiryA.id])).rows[0].n, 1);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.document_metadata WHERE rfq_id=$1', [enquiryA.id])).rows[0].n, 1);
    assert.equal('storageKey' in documentA, false); assert.equal('downloadUrl' in documentA, false);
  });

  let enquiryB;
  await t.test('API and RLS enforce company and representative assignment boundaries', async () => {
    const createdB = await create(app, authB, payload(ids.repB), 'pg-company-b-key');
    assert.equal(createdB.statusCode, 201, createdB.body); enquiryB = createdB.json().data.enquiry;
    assert.equal((await app.inject({ url: `/api/v1/enquiries/${enquiryB.id}`, headers: { cookie: authA.cookie } })).statusCode, 404);
    assert.equal((await app.inject({ url: `/api/v1/documents/${documentA.id}`, headers: { cookie: authB.cookie } })).statusCode, 404);
    const repA = await login(app, 'pg.rep.a@example.invalid');
    const repList = await app.inject({ url: '/api/v1/enquiries', headers: { cookie: repA.cookie } });
    assert.equal(repList.statusCode, 200); assert.deepEqual(repList.json().data.map(row => row.companyId), [ids.companyA]);

    const direct = await runtimePool.connect();
    try {
      await direct.query('BEGIN');
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n, 0);
      await direct.query("SELECT set_config('app.company_ids',$1,true), set_config('app.can_view_all_rfqs','enabled',true)", [ids.companyB]);
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n, 0, 'forged settings must not establish RLS scope');
      await direct.query('SELECT app.establish_request_context($1)', [hashSessionToken(authA.token, PEPPER)]);
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.rfqs WHERE company_id=$1', [ids.companyB])).rows[0].n, 0);
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.document_metadata WHERE company_id=$1', [ids.companyB])).rows[0].n, 0);
      await direct.query('ROLLBACK');
    } finally { direct.release(); }
  });

  await t.test('transaction rollback and PostgreSQL advisory-lock idempotency', async () => {
    const before = (await migrationPool.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n;
    const invalid = payload(ids.repA); invalid.items[0].configuration = {};
    const rolledBack = await create(app, authA, invalid, 'pg-rollback-key');
    assert.equal(rolledBack.statusCode, 422);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n, before);

    const key = 'pg-concurrent-idempotency-key';
    const body = payload(ids.repA);
    const [first, second] = await Promise.all([create(app, authA, body, key), create(app, authA, body, key)]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.json().data.enquiry.id, second.json().data.enquiry.id);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.idempotency_records WHERE user_id=$1 AND idempotency_key=$2", [ids.customerA, key])).rows[0].n, 1);
  });

  await t.test('SQL input handling, mass assignment, UUID and foreign-reference validation', async () => {
    const injectionLogin = await login(app, "' OR 1=1 --", 'irrelevant');
    assert.equal(injectionLogin.response.statusCode, 401, injectionLogin.response.body);
    const injection = payload(ids.repA); injection.details.application = "Fabricated'); DROP TABLE app.rfqs; --";
    assert.equal((await create(app, authA, injection, 'pg-sql-injection-key')).statusCode, 201);
    assert.equal((await migrationPool.query("SELECT to_regclass('app.rfqs') IS NOT NULL AS present")).rows[0].present, true);
    const massAssigned = payload(ids.repA); massAssigned.details.companyId = ids.companyB; massAssigned.details.priority = 'urgent';
    assert.equal((await create(app, authA, massAssigned, 'pg-mass-assignment-key')).statusCode, 422);
    assert.equal((await app.inject({ url: '/api/v1/enquiries/not-a-uuid', headers: { cookie: authA.cookie } })).statusCode, 400);
    assert.equal((await create(app, authA, payload('79999999-9999-4999-8999-999999999999'), 'pg-invalid-fk-key')).statusCode, 404);
  });

  await t.test('runtime grants prevent DDL and audit mutation while application audit inserts work', async () => {
    const client = await runtimePool.connect();
    try {
      for (const statement of ['CREATE TABLE public.runtime_forbidden(id int)', 'ALTER TABLE app.rfqs ADD COLUMN runtime_forbidden text', 'DROP TABLE app.products', 'UPDATE app.audit_events SET action=\'tampered\'', 'DELETE FROM app.audit_events']) {
        await client.query('BEGIN');
        await assert.rejects(client.query(statement));
        await client.query('ROLLBACK');
      }
    } finally { client.release(); }
    assert.ok((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE event_type='rfq.created'")).rows[0].n >= 1);
  });

  await t.test('login throttling is enforced', async () => {
    const attempts = [];
    for (let index = 0; index < 7; index += 1) attempts.push(await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '127.0.0.77', payload: { email: 'pg.customer.a@example.invalid', password: 'fabricated-wrong-password' } }));
    assert.ok(attempts.some(response => response.statusCode === 429));
  });

  await t.test('structured logs redact security-sensitive request values', async () => {
    let logs = '';
    const stream = new Writable({ write(chunk, _encoding, callback) { logs += chunk.toString(); callback(); } });
    const loggingApp = await buildApp({ config: { ...config, logLevel: 'info' }, repository, storage, logger: true, logStream: stream });
    const sentinels = ['fabricated-password-log-sentinel', 'fabricated-session-log-sentinel', 'fabricated-csrf-log-sentinel'];
    await loggingApp.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '127.0.0.88', headers: { cookie: `rhomberg_pg_test_session=${sentinels[1]}`, 'x-csrf-token': sentinels[2] }, payload: { email: 'pg.customer.a@example.invalid', password: sentinels[0] } });
    await loggingApp.close();
    for (const sentinel of sentinels) assert.equal(logs.includes(sentinel), false);
    assert.equal(logs.includes('RHOMBERG_API_DATABASE_URL'), false);
  });
});
